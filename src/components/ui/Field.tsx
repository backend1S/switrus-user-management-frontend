import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

interface FieldProps {
  id?: string
  label: string
  required?: boolean
  error?: string
  help?: ReactNode
  className?: string
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}

/** Label above, control, helper or error below. Errors are announced. */
export function Field({ id: idProp, label, required, error, help, className, children }: FieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const msgId = `${id}-msg`
  return (
    <div className={`field ${className ?? ''}`}>
      <label className="field-label" htmlFor={id}>
        {label}
        {required && (
          <span className="req" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ id, describedBy: error || help ? msgId : undefined, invalid: !!error })}
      {error ? (
        <div className="field-error" id={msgId} role="alert">
          {error}
        </div>
      ) : help ? (
        <div className="field-help" id={msgId}>
          {help}
        </div>
      ) : null}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  help?: ReactNode
  fieldClassName?: string
}

export function TextField({ label, error, help, required, fieldClassName, ...input }: InputProps) {
  return (
    <Field id={input.id} label={label} required={required} error={error} help={help} className={fieldClassName}>
      {({ id, describedBy, invalid }) => (
        <input
          {...input}
          id={id}
          className="input"
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          aria-describedby={describedBy}
          data-field={input.name}
        />
      )}
    </Field>
  )
}
