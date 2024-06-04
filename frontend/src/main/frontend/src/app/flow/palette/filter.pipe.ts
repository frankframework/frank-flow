import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filter',
})
export class FilterPipe implements PipeTransform {
  transform(
    items: any[] | undefined,
    term: string,
    matchTerm = true
  ): any[] | undefined {
    return term
      ? items?.filter(
          (item: any) =>
            item.name?.toLowerCase().includes(term.toLowerCase()) === matchTerm
        )
      : items;
  }
}
