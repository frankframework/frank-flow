import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filter',
})
export class FilterPipe implements PipeTransform {
  transform(items: any[] | undefined, term: string): any[] | undefined {
    return term
      ? items?.filter((item: any) => item.name?.includes(term))
      : items;
  }
}
