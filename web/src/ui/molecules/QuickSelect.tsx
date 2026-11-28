import { t } from "../../../../src/i18n/index.ts";
import { Select } from "../atoms/Select";

/** One quick filter of a list: a select over the values of one field; the empty value removes it. With `prefix` a value reads "Label: bug". */
export function QuickSelect({ label, value, options, onChange, prefix }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void; prefix?: boolean }) {
  return (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="w-full md:w-auto md:max-w-[13rem]">
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {prefix && v ? t("{label}: {value}", { label, value: l }) : l}
        </option>
      ))}
    </Select>
  );
}
