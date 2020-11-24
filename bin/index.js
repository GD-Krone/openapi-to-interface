const util = require('util');
const yargs = require("yargs");
const request = require('sync-request');
const {TypeGenerator, DB2TypesToTypescript} = require('../includes/TypeGenerator');
const fs = require('fs');

const options = yargs
 .usage("Usage: -j <json>")
 .option("j", { alias: "json", describe: "OpenAPI.json Datei", type: "path", demandOption: false })
 .option("u", { alias: "url", describe: "URL zum Abruf der OpenAPI.json", type: "url", demandOption: false })
 .option("o", { alias: "output", describe: "Ausgabeordner", type: "path", demandOption: true })
 .argv;


let OpenAPI = "";

if (options.json !== undefined) {
    OpenAPI = require(options.json);
}
else if (options.url !== undefined) {
    var res = request("GET", options.url);
    OpenAPI = JSON.parse(res.getBody('utf8'));
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
            for (let [name, parameter] of Object.entries(getPost.requestBody.content['application/json'].schema.properties)) {
                let type = parameter.type;
                if (type == "integer" || type == "long long") type = "number";

                obj.requestBody.push({name, type});
            }
        }

        if (getPost.responses !== undefined && getPost.responses["200"] !== undefined) {
            let typeGenerator = new TypeGenerator("Response", getPost.responses["200"].content['application/json'].schema);
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

for (let item of paths) {
    interfaceText += `/** ${item.desc} */
export namespace $${item.uuid.substring(0, 6)} {\n`;

        if (item.properties.requestPath.length) {
            interfaceText += `   export interface Parameter {\n`;
            for (let [i, col] of Object.entries(item.properties.requestPath)) {
                interfaceText += `      ${col.name}${col.required ? '' : '?'}: ${col.type};\n`;
            }
            interfaceText += `   }\n\n`;
        }

        if (item.properties.requestBody.length) {
            interfaceText += `   export interface Request {\n`;
            for (let [i, col] of Object.entries(item.properties.requestBody)) {
                interfaceText += `      ${col.name}${col.required ? '?' : ''}: ${col.type};\n`;
            }
            interfaceText += `   }\n`;
        }

        interfaceText += `
   export function Url (parameter: Parameter): string 
   {
      return \`${item.path.replace(/{/g, "${parameter.")}\`;
   }\n\n`;

    if (item.properties.responses !== undefined) {
        interfaceText += item.properties.responses.Definition();
    }

    interfaceText += "}\n";
}

let communicationServiceText = "";
let communicationImportText = "";

for (let item of paths) {
    const id = item.uuid.substring(0, 6);

    communicationServiceText += `
   /** ${item.desc} */
   public ${item.method}$${id} (parameter: $${id}.Parameter${item.properties.requestBody.length ? `, request: $${id}.Request` : ""}): Promise<${item.properties.responses !== undefined ? `$${id}.Response` : "void"}>
   {
      return this.apiCommand({
        method: "${item.method.toUpperCase()}",
        endpoint: $${id}.Url(parameter),
        payload: ${item.properties.requestBody.length ? "request" : "{}"}
      });
   }
    `;

    if (communicationImportText.length !== 0) communicationImportText += ",\n";
    communicationImportText += `    $${id}`;
}

try {
    var data = fs.readFileSync("./templates/baseCommunication.service.template.ts", 'utf8');
    fs.writeFileSync(options.output + "/communication.interface.ts", interfaceText);

    data = data.replace("[[ENDPOINTS]]", communicationServiceText);
    data = data.replace("[[IMPORTS]]", "import {\n" + communicationImportText + `\n} from "./communication.interface";`);

    fs.writeFileSync(options.output + "/baseCommunication.service.ts", data);
} catch(e) {
    console.log('Error:', e.stack);
}

//console.log(interfaceText, communicationServiceText);