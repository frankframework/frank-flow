import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { PaletteService } from './palette.service';
import { Subscription } from 'rxjs';
import { CurrentFileService } from '../../shared/services/current-file.service';
import { File } from '../../shared/models/file.model';

@Component({
  selector: 'app-palette',
  templateUrl: './palette.component.html',
  styleUrls: ['./palette.component.scss'],
})
export class PaletteComponent implements AfterViewInit, OnDestroy {
  public search!: string;
  private errors!: string[] | undefined;
  public locked: boolean = false;
  private currentFileSubscription!: Subscription;

  constructor(
    public paletteService: PaletteService,
    private currentFileService: CurrentFileService
  ) {}

  ngAfterViewInit(): void {
    this.getXmlParseErrors();
  }

  ngOnDestroy(): void {
    this.currentFileSubscription.unsubscribe();
  }

  getXmlParseErrors(): void {
    this.currentFileSubscription =
      this.currentFileService.currentFileObservable.subscribe({
        next: (file: File) => {
          this.errors = file.errors;
          this.locked = this.XmlErrorsFound();
        },
      });
  }

  XmlErrorsFound(): boolean {
    return this.errors !== undefined && this.errors.length > 0;
  }
}
