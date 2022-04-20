import { Pipe, PipeTransform } from '@angular/core';
@Pipe({
  name: 'filter',
})
export class FilterPipe implements PipeTransform {
  transform(
    items: any[] | undefined,
    term: string,
    not = false
  ): any[] | undefined {
    return term
      ? items?.filter((item: any) => {
          const match = item.name?.toLowerCase().includes(term.toLowerCase());
          return not ? !match : match;
        })
      : items;
  }
}
