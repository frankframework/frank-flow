import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FileTreeItemModel } from '../../shared/models/file-tree-item.model';
import { File } from '../../shared/models/file.model';
import { first, Subject, Subscription } from 'rxjs';
import { FileService } from '../../shared/services/file.service';
import { CurrentFileService } from '../../shared/services/current-file.service';
import { Configuration } from '../../shared/models/configuration.model';

@Component({
  selector: 'app-custom-file-tree',
  templateUrl: './custom-file-tree.component.html',
  styleUrls: ['./custom-file-tree.component.scss'],
})
export class CustomFileTreeComponent implements OnInit, OnDestroy {
  @Input() public width: string | number = '100%';
  @Input() public height: string | number = '100%';
  @Input() public fileMatch?: RegExp;

  public treeData: FileTreeItemModel[] = [];

  private currentFile!: File;
  private files!: any;
  private currentFileSubscription!: Subscription;
  private fileSubscription!: Subscription;

  public userSelectedNewFileObservable!: Subject<boolean>;

  constructor(
    private fileService: FileService,
    private currentFileService: CurrentFileService
  ) {}

  ngOnInit(): void {
    this.getFiles();
    this.subscribeToCurrentFile();
    this.userSelectedNewFileObservable =
      this.currentFileService.userSelectedNewFileObservable;
  }

  ngOnDestroy(): void {
    this.currentFileSubscription?.unsubscribe();
    this.fileSubscription?.unsubscribe();
    this.userSelectedNewFileObservable?.unsubscribe();
  }

  getFiles(): void {
    this.fileSubscription = this.fileService.getFiles().subscribe({
      next: (files: any): void => {
        this.files = files;
        this.updateFileTree();
      },
    });
  }

  updateFileTree(): void {
    this.currentFileService.resetCurrentDirectory();
    this.addFilesToTree();
  }

  addFilesToTree(): void {
    this.treeData = this.files.map(
      (configuration: Configuration): FileTreeItemModel => {
        return this.parseFolder(
          configuration.name,
          configuration.name,
          configuration.content
        );
      }
    );
  }

  parseFolder(
    name: string,
    configuration: string,
    content: any,
    path: string = ''
  ): FileTreeItemModel {
    return {
      name: name,
      path: path + name,
      type: 'folder',
      children: this.parseFiles(configuration, content, path + name + '/'),
      expanded: false,
    };
  }

  parseFiles(
    configuration: string,
    content: any,
    path = ''
  ): FileTreeItemModel[] {
    const items: FileTreeItemModel[] = [];
    Object.keys(content).map((key: string): void => {
      if (key === '_files') {
        for (const file of content._files) {
          if (!this.fileMatch || this.fileMatch.test(file)) {
            items.push(this.parseFile(configuration, file, path));
          }
        }
      } else if (this.getFileExtension(path) === undefined) {
        items.push(this.parseFolder(key, configuration, content[key], path));
      } else {
        items.push(this.parseFile(configuration, content[key], path));
      }
    });
    return items;
  }

  parseFile(
    configuration: string,
    content: any,
    path: string = ''
  ): FileTreeItemModel {
    if (content['string']) {
      return content['string'].endsWith('.xml')
        ? {
            name: configuration,
            path: path + content['string'],
            type: 'file',
            currentlySelected: false,
            extension: this.getFileExtension(configuration),
            saved: false,
            fileType: 'configuration',
            expanded: false,
            flowNeedsUpdate: false,
            firstLoad: true,
          }
        : {
            name: configuration,
            path: path + content['string'],
            currentlySelected: false,
            type: 'file',
            fileType: 'other',
            extension: this.getFileExtension(configuration),
            saved: false,
            firstLoad: true,
          };
    } else {
      return this.parseFolder(configuration, configuration, content);
    }
  }

  getFileExtension(fileName: string): string | undefined {
    if (fileName.includes('.')) {
      const parts: string[] = fileName.split('.');
      return parts[parts.length - 1];
    }
    return undefined;
  }

  subscribeToCurrentFile(): void {
    this.currentFileSubscription =
      this.currentFileService.currentFileObservable.subscribe(
        (currentFile: File): void => {
          this.currentFile = currentFile;
          this.userSelectedNewFileObservable.pipe(first()).subscribe({
            next: (value: boolean): void => {
              if (value) {
                this.userSelectedNewFileObservable.next(false);
              } else {
                this.updateFileTree();
              }
            },
          });
        }
      );
  }
}
