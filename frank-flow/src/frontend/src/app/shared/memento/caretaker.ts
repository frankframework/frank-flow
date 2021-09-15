import { Memento } from '../models/memento.model';
import { Originator } from './originator';

export class Caretaker {
  private mementos: Memento[] = [];
  private redoMementos: Memento[] = [];

  private originator: Originator;

  constructor(originator: Originator) {
    this.originator = originator;
  }

  public save(): void {
    const memento = this.originator.save();
    this.mementos.push(memento);
  }

  public redo(): void {
    const undoMemento = this.redoMementos.pop();

    if (undoMemento) {
      this.originator.restore(undoMemento);
    }
  }

  public clearRedoList(): void {
    this.redoMementos = [];
  }

  public clearMementoList(): void {
    this.mementos = [];
  }

  public undo(): void {
    if (!this.mementos.length) {
      return;
    }

    const previousMemento = this.mementos[this.mementos.length - 2];
    const currentMemento = this.mementos.pop();

    if (previousMemento) {
      this.originator.restore(previousMemento);

      if (currentMemento) {
        this.redoMementos.push(currentMemento);
      }
    }
  }
}
