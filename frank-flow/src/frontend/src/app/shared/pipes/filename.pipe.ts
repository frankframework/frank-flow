import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filename',
})
export class FilenamePipe implements PipeTransform {
  transform(value: string): unknown {
    const splitValues: string[] = value.split('/');
    if (splitValues.length == 1) {
      return splitValues[0];
    } else if (splitValues.length > 1) {
      return splitValues[splitValues.length - 1];
    }
    return value;
  }
}
