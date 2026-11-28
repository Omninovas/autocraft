// Catches a render error in the routed view, so the shell (navigation, search, menus) stays usable and the page shows
// what failed instead of going blank. Moving to another URL, query included, renders the view again.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { t } from "../../../src/i18n/index.ts";
import { Button } from "../ui/atoms/Button";
import { ErrorLine } from "../ui/atoms/ErrorLine";

type Props = { resetKey: string; children: ReactNode };
type State = { error: Error | null; key: string };

class Boundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey === state.key ? null : { error: null, key: props.resetKey };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Page render failed", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex max-w-[1100px] flex-col items-start gap-3 px-4 pb-10 pt-5 md:px-6">
          <h1 className="text-xl font-semibold">{t("This page could not be shown")}</h1>
          <ErrorLine error={error.message || error.name} />
          <Button icon={ArrowClockwiseIcon} variant="primary" onClick={() => window.location.reload()} className="max-md:h-11">
            {t("Reload")}
          </Button>
        </div>
      </div>
    );
  }
}

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return <Boundary resetKey={loc.pathname + loc.search}>{children}</Boundary>;
}
