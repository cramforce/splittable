
export function test() {
  this.todos = this.todos.map(
    todo => ({ ...todo, completed })
  );
}
