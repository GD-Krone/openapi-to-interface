[[IMPORTS]]

declare var command: any;

export class BaseCommunicationService 
{
  //Wrapper um Function mit Callbacks als Promise verwenden zu können
  private async apiCommand<Response> (verb: "POST" | "GET", commandStr: string, payload: object): Promise<Response>
  {
    return new Promise(function(resolve, reject) {
      command('open_api', JSON.stringify({verb, command: commandStr, "json": JSON.stringify(payload)}), (response) => resolve(JSON.parse(response)), reject);
    });
  }
  [[ENDPOINTS]]
}
