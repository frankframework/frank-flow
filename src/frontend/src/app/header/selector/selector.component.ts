import { Component, OnInit } from '@angular/core';
import { FileService } from '../../shared/services/file.service';
import { Configuration } from '../../shared/models/configuration.model';

interface Option {
  text: string;
  value: string;
}

@Component({
  selector: 'app-selector',
  templateUrl: './selector.component.html',
  styleUrls: ['./selector.component.scss'],
})
export class SelectorComponent implements OnInit {
  options: Option[] = [];

  constructor(private fileService: FileService) {}

  ngOnInit(): void {
    this.getFiles();
  }

  getFiles(): void {
    this.fileService.getFiles().subscribe({
      next: (configurationFiles) =>
        this.addConfigurationsToSelector(configurationFiles),
    });
  }

  addConfigurationsToSelector(configurationFiles: any): void {
    configurationFiles.forEach((configuration: Configuration) => {
      this.options.push({
        text: configuration.name,
        value: configuration.name,
      });

      this.addFilesToSelector(configuration.name, configuration.content);
    });
  }

  addFilesToSelector(
    configuration: string,
    content: any,
    path: string = ''
  ): void {
    Object.keys(content).map((key) => {
      if (key === '_files') {
        content._files.forEach((file: string) =>
          this.options.push({
            text: path + file,
            value: JSON.stringify({ configuration, path: path + file }),
          })
        );
      } else {
        this.options.push({
          text: key,
          value: key,
        });
        this.addFilesToSelector(configuration, content[key], key + '/');
      }
    });
  }
}
