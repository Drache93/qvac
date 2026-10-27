export class Context {
    _root;
    _scope;
    _values;
    constructor(scope) {
        this._root = this;
        this._scope = scope;
        this._values = Object.create(null);
    }
    get(name) {
        this._scope.assertActive();
        const value = this._root._values[name];
        if (value === undefined) {
            throw new Error(`Service "${name}" is not available`);
        }
        return value;
    }
    provide(name, value) {
        this._scope.assertOpen();
        const root = this._root;
        if (name in root) {
            throw new Error(`Context property "${name}" is already registered or reserved`);
        }
        if (value === undefined) {
            throw new Error(`Service "${name}" cannot be undefined`);
        }
        root._values[name] = value;
        Object.defineProperty(root, name, {
            configurable: true,
            get() {
                return this.get(name);
            }
        });
        this._scope.onRelease(() => {
            delete root._values[name];
            Reflect.deleteProperty(root, name);
        });
    }
    onDispose(dispose) {
        this._scope.onDispose(dispose);
    }
}
export function createContext(scope, root) {
    if (!root) {
        return new Context(scope);
    }
    return Object.create(root, { _scope: { value: scope } });
}
