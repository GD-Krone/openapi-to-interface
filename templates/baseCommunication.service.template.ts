/* eslint @typescript-eslint/no-explicit-any: off */

[[IMPORTS]]

declare var cypher: any;
declare var command: any;

export class BaseCommunicationService 
{
   cypher ()
   {
      new cypher();
   }

   //Wrapper um Function mit Callbacks als Promise verwenden zu können
   private async apiCommand<Response> (verb: "POST" | "GET", commandStr: string, payload: object): Promise<Response>
   {
      return new Promise((resolve, reject) => {
         command("open_api", JSON.stringify({verb, "command": commandStr, "json": JSON.stringify(payload)}), (response: string) => resolve(JSON.parse(response)), reject);
      });
   }

   [[ENDPOINTS]]
}
