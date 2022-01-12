import { Injectable } from '@angular/core';
import { Configuration } from '../models/configuration.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { File } from '../models/file.model';

@Injectable({
  providedIn: 'root',
})
export class FileService {
  BASE_PATH = window.location.href + 'api/configurations';
  configurationFiles = new BehaviorSubject<Configuration[]>([]);

  constructor() {
    this.fetchFiles();
  }

  fetchFiles(): void {
    this.getConfigurationsWithFiles().then((configurationFiles) => {
      this.configurationFiles.next(configurationFiles);
    });
  }

  async getConfigurationsWithFiles(): Promise<Configuration[]> {
    const configurationFiles: Configuration[] = [];
    await this.getConfigurations().then(async (configurations) => {
      if (configurations) {
        for (const configuration of configurations) {
          await this.getFilesForConfiguration(configuration).then((files) => {
            if (!files.error) {
              configurationFiles.push({ name: configuration, content: files });
            }
          });
        }
      }
    });
    return configurationFiles;
  }

  getConfigurations(): Promise<string[]> {
    return fetch(this.BASE_PATH)
      .then((response) => response.json())
      .catch((error) => console.error(error));
  }

  getFilesForConfiguration(configuration: string): Promise<any> {
    return fetch(`${this.BASE_PATH}/${configuration}`)
      .then((response) => response.json())
      .catch((error) => console.error(error));
  }

  getFiles(): Observable<any> {
    return this.configurationFiles.asObservable();
  }

  getFileFromConfiguration(
    configuration: string,
    path: string
  ): Promise<string | void> {
    return fetch(`${this.BASE_PATH}/${configuration}/files/?path=${path}`)
      .then((response) => response.text())
      .catch((error) => console.error(error));
  }

  updateFileForConfiguration(
    configuration: string,
    path: string,
    content: string
  ): Promise<boolean | void> {
    const formData = new FormData();
    formData.append('file', content);

    return fetch(`${this.BASE_PATH}/${configuration}/files/?path=${path}`, {
      method: 'POST',
      body: formData,
    })
      .then((response) => response.ok)
      .catch((error) => console.error(error));
  }

  removeFileFromConfiguration(file: File): Promise<boolean | void> {
    return fetch(
      `${this.BASE_PATH}/${file.configuration}/files/?path=${file.path}`,
      {
        method: 'DELETE',
      }
    )
      .then((response) => response.ok)
      .catch((error) => console.error(error));
  }
}
