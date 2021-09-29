import { Component, OnInit } from '@angular/core';
import { PaletteService } from './palette.service';
import { FlowStructureService } from '../../shared/services/flow-structure.service';

@Component({
  selector: 'app-palette',
  templateUrl: './palette.component.html',
  styleUrls: ['./palette.component.scss'],
})
export class PaletteComponent implements OnInit {
  public search!: string;
  private errors!: string[];
  public locked: boolean = false;

  constructor(
    public paletteService: PaletteService,
    private flowStructureService: FlowStructureService
  ) {}

  ngOnInit(): void {
    this.getXmlParseErrors();
  }

  getXmlParseErrors(): void {
    this.flowStructureService.errorObservable().subscribe({
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
