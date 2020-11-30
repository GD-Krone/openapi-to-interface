const util = require("util");
const yargs = require("yargs");
const request = require("sync-request");
const camelCase = require("camelcase");
const {TypeGenerator, DB2TypesToTypescript} = require(__dirname + "/../includes/TypeGenerator");
const fs = require("fs");

const options = yargs
 .usage("Usage: -j <json>")
 .option("j", { alias: "json", describe: "OpenAPI.json Datei", type: "path", demandOption: false })
 .option("u", { alias: "url", describe: "URL zum Abruf der OpenAPI.json", type: "url", demandOption: false })
 .option("t", { alias: "templates", describe: "Template-Ordner", type: "path", demandOption: false })
 .option("o", { alias: "output", describe: "Ausgabeordner", type: "path", demandOption: false })
 .option("c", { alias: "config", describe: "Config", type: "path", demandOption: false })
 .argv;

 let config = {
    "output": options.output,
    "templates": options.templates || __dirname + "/../templates",
    "json": options.json,
    "url": options.url
}

if (options.config !== undefined) {
    config = JSON.parse(fs.readFileSync(options.config))["openapi-to-interface"];
}

let OpenAPI = "";

if (config.json !== undefined) {
    OpenAPI = JSON.parse(fs.readFileSync(config.json));
}
else if (config.url !== undefined) {
    var res = request("GET", config.url);
    OpenAPI = JSON.parse(res.getBody("utf8"));
}

let paths = [];

function MakePath (path, getPost, method)
{
    let endpoint = {
        uuid: "",
        path,
        methods: {},
        desc: ""
    }

    let obj = {requestPath: [], requestBody: [], responses: undefined};

    if (getPost !== undefined) {
        if (getPost.parameters !== undefined) {
            for (let parameter of getPost.parameters) {
                if (parameter.schema === undefined) continue;

                obj.requestPath.push({
                    name: parameter.name,
                    required: parameter.required,
                    type: DB2TypesToTypescript(parameter.schema.type)
                });
            }
        }

        if (getPost.requestBody !== undefined) {
            for (let [name, parameter] of Object.entries(getPost.requestBody.content["application/json"].schema.properties)) {
                let type = parameter.type;
                if (type == "integer" || type == "long long") type = "number";

                obj.requestBody.push({name, type});
            }
        }

        if (getPost.responses !== undefined && getPost.responses["200"] !== undefined) {
            let typeGenerator = new TypeGenerator("Response", getPost.responses["200"].content["application/json"].schema);
            if (typeGenerator.Valid()) endpoint.responses = typeGenerator;
            endpoint.desc = getPost.responses["200"].description;
        }

        endpoint.method = method;
        endpoint.properties = obj;
        endpoint.uuid = getPost["x-uuid"];
    }  
    return endpoint;
}

for (let [path, definition] of Object.entries(OpenAPI.paths)) {
    if (definition.get  !== undefined) paths.push(MakePath(path, definition.get, "get"));
    if (definition.post !== undefined) paths.push(MakePath(path, definition.post, "post"));
}

let interfaceText = "";

function GenerateID (method, path, uuid)
{
    const splitPath = path.split(/\/{(.+)/);
    return method + camelCase(splitPath[0].replace(/\//g, "-"), {pascalCase: true}) + "$" + splitPath[1].replace(/}\/{/g, "$").slice(0, -1);
}

for (let item of paths) {
    const id = GenerateID(item.method, item.path, item.uuid); 

    interfaceText += `/** ${item.desc} */
export namespace ${id} {\n`;

        if (item.properties.requestPath.length) {
            interfaceText += `   export interface Parameter {\n`;
            for (let [i, col] of Object.entries(item.properties.requestPath)) {
                interfaceText += `      ${col.name}${col.required ? "" : "?"}: ${col.type};\n`;
            }
            interfaceText += `   }\n\n`;
        }

        if (item.properties.requestBody.length) {
            interfaceText += `   export interface Request {\n`;
            for (let [i, col] of Object.entries(item.properties.requestBody)) {
                interfaceText += `      ${col.name}${col.required ? "?" : ""}: ${col.type};\n`;
            }
            interfaceText += `   }\n`;
        }

        interfaceText += `
   export function Url (${item.properties.requestPath.length ? "parameter: Parameter" : ""}): string 
   {
      return \`${item.path.replace(/{/g, "${parameter.")}\`;
   }\n\n`;

    if (item.responses !== undefined) {
        interfaceText += item.responses.Definition();
    }

    interfaceText += "}\n";
}

let communicationServiceText = "";
let communicationImportText = "";

for (let item of paths) {
    const id = GenerateID(item.method, item.path, item.uuid); 

    communicationServiceText += `
   /** ${item.desc} */
   public ${id} (${item.properties.requestPath.length ? `parameter: ${id}.Parameter` : ""}${item.properties.requestPath.length && item.properties.requestBody.length ? ", " : ""}${item.properties.requestBody.length ? `request: ${id}.Request` : ""}): Promise<${item.responses !== undefined ? `${id}.Response` : "void"}>
   {
      return this.apiCommand("${item.method.toUpperCase()}", ${id}.Url(${item.properties.requestPath.length ? "parameter" : ""}), ${item.properties.requestBody.length ? "request" : "{}"});
   }
    `;

    if (communicationImportText.length !== 0) communicationImportText += ",\n";
    communicationImportText += `    ${id}`;
    
    console.log(`   generate interface ${id}`);
}

try {
   {
      let data = fs.readFileSync(__dirname + "/../templates/communication.interface.template.ts", "utf8");
      data = data.replace("[[INTERFACES]]", interfaceText);

      fs.writeFileSync(config.output + "/communication.interface.ts", data);
   }

   {
      let data = fs.readFileSync(__dirname + "/../templates/baseCommunication.service.template.ts", "utf8");
      data = data.replace("[[ENDPOINTS]]", communicationServiceText);
      data = data.replace("[[IMPORTS]]", "import {\n" + communicationImportText + `\n} from "./communication.interface";`);

      fs.writeFileSync(config.output + "/baseCommunication.service.ts", data);
   }
   
   console.log(`   ${paths.length} interfaces generated`);
} catch(e) {
   console.log("Error:", e.stack);
}

//console.log(interfaceText, communicationServiceText);