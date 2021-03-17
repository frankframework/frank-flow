import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Configuration } from '../models/configuration.model';

@Injectable({
  providedIn: 'root',
})
export class FileService {
  BASE_PATH = environment.runnerUri + 'frank-flow/api/configurations';

  constructor() {}

  getConfigurations(): Promise<string[]> {
    return fetch(this.BASE_PATH)
      .then((result) => result.json())
      .catch((error) => console.error(error));
  }

  getFilesForConfiguration(configuration: string): Promise<any> {
    return fetch(`${this.BASE_PATH}/${configuration}`)
      .then((result) => result.json())
      .catch((error) => console.error(error));
  }

  async getConfigurationsWithFiles(): Promise<Configuration[]> {
    const configurationFiles: Configuration[] = [];
    await this.getConfigurations().then(async (configurations) => {
      for (const configuration of configurations) {
        await this.getFilesForConfiguration(configuration).then((files) =>
          configurationFiles.push({ name: configuration, content: files })
        );
      }
    });
    return configurationFiles;
  }

  getFileFromConfiguration(
    configuration: string,
    path: string
  ): Promise<string | void> {
    return fetch(`${this.BASE_PATH}/${configuration}/files/?path=${path}`)
      .then((result) => result.text())
      .catch((error) => console.error(error));
  }
}
