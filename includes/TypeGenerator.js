class TypeGenerator {
    Name = "";
    Types = {};
    Properties = {};

    constructor (name, obj)
    {
        this.Name = name;

        for (let [name, type] of Object.entries(obj.properties)) {
            if (name === "_links") continue;

            this.Properties[name] = this.BuildType(name, type);
        }
    }

    Valid ()
    {
        return Object.keys(this.Properties).length !== 0;
    }

    BuildType (name, obj)
    {
        const upperName = `${this.Name}$${name.charAt(0).toUpperCase() + name.slice(1)}`;

        if (obj.type === "object") {
            if (!this.Types.hasOwnProperty(upperName)) {
                let properties = {};
                for (let [propName, propType] of Object.entries(obj.properties)) {
                    const propUpperName = propName.charAt(0).toUpperCase() + propName.slice(1);
                    properties[propName] = this.BuildType(propUpperName, propType);
                }

                this.Types[upperName] = {type: "object", properties};
            }

            return upperName;
        }

        if (obj.type === "array") {
            if (!this.Types.hasOwnProperty(upperName)) {
                let properties = {};
                for (let [propName, propType] of Object.entries(obj.items.properties)) {
                    const propUpperName = propName.charAt(0).toUpperCase() + propName.slice(1);
                    properties[propName] = this.BuildType(propUpperName, propType);
                }

                this.Types[upperName] = {type: "array", properties};
            }

            return upperName;
        }
        
        return DB2TypesToTypescript(obj.type);
    }

    TypeDefinitions ()
    {
        let text = ``;

        for (const [typeName, type] of Object.entries(this.Types)) {
            text += `   export interface ${typeName} {\n`;

            for (const [propName, propType] of Object.entries(type.properties)) {
                text += `      ${propName}: ${propType}${this.IsArray(propType) ? "[]" : ""};\n`;
            }

            text += `   }\n\n`;
        }

        return text;
    }

    IsArray (typeName)
    {
        return this.Types.hasOwnProperty(typeName) && this.Types[typeName].type === "array";
    }

    Definition ()
    {
        let text = this.TypeDefinitions();
        
        if (Object.keys(this.Properties).length !== 0) {
            text += `   export interface ${this.Name} {\n`;

            for (const [propName, propType] of Object.entries(this.Properties)) {
                text += `      ${propName}: ${propType}${this.IsArray(propType) ? "[]" : ""};\n`;
            }

            text += `   }\n`;
        }

        return text;
    }
}

function DB2TypesToTypescript (type)
{
    if (type == "integer" || type == "long long") return "number";
    return type;
}

module.exports = {TypeGenerator, DB2TypesToTypescript};