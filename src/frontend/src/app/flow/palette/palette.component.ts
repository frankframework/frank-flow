import { Component, OnInit } from '@angular/core';
import { Node } from '../node/node';

@Component({
  selector: 'app-palette',
  templateUrl: './palette.component.html',
  styleUrls: ['./palette.component.scss'],
})
export class PaletteComponent implements OnInit {
  listeners = [
    { id: '1', name: 'ApiListener' },
    { id: '1', name: 'ApiListener' },
    { id: '1', name: 'ApiListener' },
    { id: '1', name: 'ApiListener' },
    { id: '1', name: 'ApiListener' },
    { id: '1', name: 'ApiListener' },
    { id: '1', name: 'ApiListener' },
    { id: '1', name: 'ApiListener' },
  ] as Node[];
  pipes = [
    { id: '2', name: 'FixedResultPipe' },
    { id: '2', name: 'FixedResultPipe' },
    { id: '2', name: 'FixedResultPipe' },
    { id: '2', name: 'FixedResultPipe' },
    { id: '2', name: 'FixedResultPipe' },
    { id: '2', name: 'FixedResultPipe' },
    { id: '2', name: 'FixedResultPipe' },
    { id: '2', name: 'FixedResultPipe' },
    { id: '2', name: 'FixedResultPipe' },
    { id: '2', name: 'FixedResultPipe' },
    { id: '2', name: 'FixedResultPipe' },
    { id: '2', name: 'FixedResultPipe' },
    { id: '2', name: 'FixedResultPipe' },
    { id: '2', name: 'FixedResultPipe' },
  ] as Node[];
  exits = [
    { id: '3', name: 'Exit' },
    { id: '3', name: 'Exit' },
    { id: '3', name: 'Exit' },
  ] as Node[];

  constructor() {}

  ngOnInit(): void {}
}
