import { Memento } from '../interfaces/memento';
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

  public undo(): void {
    if (!this.mementos.length) {
      return;
    }

    const currentMemento = this.mementos.pop();
    const previousMemento = this.mementos.pop();

    if (previousMemento) {
      this.originator.restore(previousMemento);

      if (currentMemento) {
        this.redoMementos.push(currentMemento);
      }
    }
  }
}
