import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaletteComponent } from './palette.component';
import { SearchComponent } from './search/search.component';
import { FormsModule } from '@angular/forms';
import { GroupComponent } from './group/group.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ItemComponent } from './item/item.component';
import { FilterPipe } from './filter.pipe';

@NgModule({
  declarations: [
    PaletteComponent,
    SearchComponent,
    GroupComponent,
    ItemComponent,
    FilterPipe,
  ],
  exports: [PaletteComponent],
  imports: [CommonModule, FormsModule, FontAwesomeModule],
})
export class PaletteModule {}
