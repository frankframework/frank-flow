import { Injectable } from '@angular/core';
import { IbisDocService } from 'src/app/shared/services/ibis-doc.service';

@Injectable({
  providedIn: 'root',
})
export class PaletteService {
  data: Map<string, any[]> = new Map<string, any[]>();

  constructor(private ibisDocService: IbisDocService) {
    this.getIbisDoc();
  }

  getIbisDoc(): void {
    this.ibisDocService.getIbisDoc().subscribe({
      next: (ibisDoc: any) => {
        ibisDoc.forEach((group: any) => {
          this.data.set(group.name, group.classes);
        });
      },
    });
  }
}
