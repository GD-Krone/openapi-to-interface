[[IMPORTS]]

declare var command: any;

export class BaseCommunicationService 
{
  //Wrapper um Function mit Callbacks als Promise verwenden zu können
  private async apiCommand<Response> (apiCommand: any): Promise<Response>
  {
    const payload = JSON.stringify({ 
      "verb": apiCommand.method,
      "command": apiCommand.endpoint,
      "json": JSON.stringify(apiCommand.payload || {})
    });

    return new Promise(function(resolve, reject) {
      command('open_api', payload, resolve, reject);
    });
  }
  [[ENDPOINTS]]
}
