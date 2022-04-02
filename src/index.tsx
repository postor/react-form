
import { createContext, FC, useContext, useRef, useState } from "react";

type Field = {
  value: string;
  error?: any;
  validating: boolean;
  touched: boolean;
  setValue: (value: string) => void;
};

type ValidateFn = (val: string) => Promise<void | any>;

interface OptionField extends Field {
  validate: ValidateFn;
  initValidate: (fn: ValidateFn) => ValidateFn;
}

type UserOptionField = Omit<OptionField, "validating">;

type Fields<T> = {
  [key: string]: T;
};

interface ContextData<T> {
  errorFields: string[];
  formData: { [key: string]: string };
  validatingFields: string[];
  untouchedFields: string[];
  getField: (name: string) => Field;
  /**
   * short for getField
   */
  f: (name: string) => Field;
  register: (name: string, options?: Partial<UserOptionField>) => Field;
  setField: (name: string, field: Partial<UserOptionField>) => void;
}

let vid = 0

const Ctx = createContext({} as ContextData<Field>);

export const { Consumer } = Ctx;

export const useForm = () => useContext(Ctx);

export const useField = (name: string) => useForm().getField(name);

export const Provider: FC = ({ children }) => {
  let fields = useRef({} as Fields<OptionField>);
  let [ctx, setCtx] = useState({
    validatingFields: [] as string[],
    errorFields: [] as string[],
    untouchedFields: [] as string[],
    getField,
    f: getField,
    setField,
    formData: {},
    register
  } as ContextData<Field>);

  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;

  function register(name: string, options: Partial<OptionField> = {}) {
    if (!fields.current[name]) {
      let { validate = async (_) => { }, initValidate } = options;
      if (initValidate) validate = initValidate(validate);
      setField(
        name,
        {
          ...options,
          validate: async () => await validate(fields.current[name].value)
        },
        true
      );
    }
    return getField(name);
  }

  function getField(name: string): Field {
    return fields.current[name] ? fields.current[name] : getFieldDefaults(name);
  }

  function setField(name: string, field: Partial<OptionField>, delay = false) {
    let { value } = field;
    let f = fields.current[name];
    let valueChanged = !delay
      ? value === undefined
        ? false
        : value !== f.value
      : true;
    f = f || getFieldDefaults(name);

    f = {
      ...f,
      ...field
    };
    if (valueChanged) f.validating = true;
    fields.current = {
      ...fields.current,
      [name]: f
    };

    const callback = () => {

      updateCtx();
      let f = fields.current[name], tid = ++vid;
      if (valueChanged)
        // @ts-ignore
        f.promise = f
          // @ts-ignore
          .validate()
          .then(() => tid == vid && setField(name, {
            error: undefined,
            validating: false
          }))
          .catch((e) => tid == vid && setField(name, {
            error: e,
            validating: false
          }));

    };

    delay ? Promise.resolve().then(callback) : callback();
  }

  function getFieldDefaults(name: string): Field {
    return {
      value: "",
      validating: false,
      touched: false,
      setValue: (value: string) => setField(name, { value, touched: true })
    };
  }

  function updateCtx() {
    let f = fields.current;
    let k = Object.keys(f);

    setCtx((x) => {
      let rtn = {
        ...x,
        validatingFields: k.filter((x) => f[x].validating),
        errorFields: k.filter((x) => f[x].error),
        untouchedFields: k.filter((x) => !f[x].touched),
        formData: getFormData()
      };

      return rtn;
    });
  }

  function getFormData() {
    let f = fields.current;
    let k = Object.keys(f);
    let d = {} as { [key: string]: string };
    k.forEach((x) => (d[x] = f[x].value));
    return d;
  }
};
