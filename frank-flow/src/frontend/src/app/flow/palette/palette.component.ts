import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { PaletteService } from './palette.service';
import { FlowStructureService } from '../../shared/services/flow-structure.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-palette',
  templateUrl: './palette.component.html',
  styleUrls: ['./palette.component.scss'],
})
export class PaletteComponent implements AfterViewInit, OnDestroy {
  public search!: string;
  private errors!: string[];
  public locked: boolean = false;
  private errorSubscription!: Subscription;

  constructor(
    public paletteService: PaletteService,
    private flowStructureService: FlowStructureService
  ) {}

  ngAfterViewInit(): void {
    this.getXmlParseErrors();
  }

  ngOnDestroy(): void {
    this.errorSubscription.unsubscribe();
  }

  getXmlParseErrors(): void {
    this.errorSubscription = this.flowStructureService
      .errorObservable()
      .subscribe({
        next: (errors) => {
          this.errors = errors;
          this.locked = this.XmlErrorsFound();
        },
      });
  }

  XmlErrorsFound(): boolean {
    return this.errors.length > 0;
  }
}
