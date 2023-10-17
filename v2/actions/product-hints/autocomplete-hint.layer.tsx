import { UnoOrchestrator } from "@/v2/orchestrator";
import { Hotkey } from "@/v2/orchestrator/hotkeys";
import { LightbulbIcon } from "@/v2/ui/components/svgs";
import { useCloseLayer } from "@/v2/ui/layers/layer-context";
import { Tooltip } from "@/v2/ui/layers/layouts/tooltip";
import { Path } from "@/v2/ui/paths";

UnoOrchestrator.registerLayerRoute(() => ({
  pattern: Path.AutocompleteHint,
  element: <AutofillHint />,
  layout: <Tooltip.Layout />,
}));

function AutofillHint() {
  const close = useCloseLayer();

  return (
    <Hotkey pattern="esc" onActivate={close}>
      <div className="flex w-[165px] flex-col">
        <div className="flex items-start justify-between">
          <LightbulbIcon className="h-[24px] w-[24px] fill-current" />
          <Tooltip.CloseButton className="fill-black/20 transition-colors hover:fill-black/50" />
        </div>
        <div className="mt-3 w-[180px]">Uno can autofill fields! Few handy tips:</div>
        <div className="mt-3 flex w-[180px] flex-col items-center">
          <div className="flex w-full items-center">
            <div className="flex w-full flex-wrap items-center">
              <div className="flex w-full flex-col">
                <div className="break-word flex w-full items-center">
                  <span className="mr-1">Tap</span>
                  <svg
                    width="30"
                    height="13"
                    viewBox="0 0 30 13"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mr-1"
                  >
                    <rect width="30" height="13" rx="4" fill="black" />
                    <path
                      d="M3.81299 9V4.06787H7.08057V4.91895H4.84521V6.1084H6.9541V6.90137H4.84521V8.14893H7.08057V9H3.81299ZM8.16748 9V4.06787H9.02881L11.3052 7.20898H11.3599V4.06787H12.3477V9H11.4932L9.20996 5.84521H9.15527V9H8.16748ZM14.7437 9V4.91895H13.2637V4.06787H17.2559V4.91895H15.7759V9H14.7437ZM18.1685 9V4.06787H21.436V4.91895H19.2007V6.1084H21.3096V6.90137H19.2007V8.14893H21.436V9H18.1685ZM22.5229 9V4.06787H24.5771C25.6982 4.06787 26.3408 4.66602 26.3408 5.63672V5.64355C26.3408 6.27588 26.0127 6.81934 25.4487 7.0415L26.4878 9H25.3188L24.3994 7.19531H23.5552V9H22.5229ZM23.5552 6.44336H24.4644C24.9805 6.44336 25.2847 6.14941 25.2847 5.66406V5.65723C25.2847 5.18213 24.9668 4.87451 24.4507 4.87451H23.5552V6.44336Z"
                      fill="white"
                    />
                  </svg>
                  <span>to use the</span>
                </div>
                <span>autofill suggestion.</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex w-[180px] flex-col items-center">
          <div className="flex w-full items-center">
            <div className="flex w-full flex-wrap items-center">
              <div className="flex w-full flex-col">
                <div className="break-word flex w-full items-center">
                  <span className="mr-1">Tap</span>
                  <svg width="15" height="13" viewBox="0 0 15 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="15" height="13" rx="4" fill="black" />
                    <path
                      d="M4.1709 6.52197C4.1709 6.38867 4.229 6.24854 4.32129 6.15625L6.54639 3.93457C6.65234 3.82861 6.77539 3.77734 6.89502 3.77734C7.18555 3.77734 7.38379 3.979 7.38379 4.24561C7.38379 4.396 7.31885 4.51221 7.22656 4.60107L6.46094 5.37012L5.70557 6.06738L6.45068 6.02637H10.313C10.6206 6.02637 10.8257 6.22461 10.8257 6.52197C10.8257 6.81592 10.6206 7.01758 10.313 7.01758H6.45068L5.70215 6.97656L6.46094 7.67383L7.22656 8.43945C7.31885 8.52832 7.38379 8.64795 7.38379 8.79492C7.38379 9.06152 7.18555 9.26318 6.89502 9.26318C6.77539 9.26318 6.65234 9.21191 6.5498 9.10938L4.32129 6.8877C4.229 6.79541 4.1709 6.65527 4.1709 6.52197Z"
                      fill="white"
                    />
                  </svg>

                  <span className="mx-1"> or </span>
                  <svg
                    width="15"
                    height="13"
                    viewBox="0 0 15 13"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mr-1"
                  >
                    <rect width="15" height="13" rx="4" fill="black" />
                    <path
                      d="M10.8257 6.52197C10.8257 6.65527 10.7676 6.79541 10.6753 6.8877L8.44678 9.10938C8.34424 9.21191 8.22119 9.26318 8.10156 9.26318C7.81104 9.26318 7.61279 9.06152 7.61279 8.79492C7.61279 8.64795 7.67773 8.52832 7.77002 8.43945L8.53564 7.67383L9.29443 6.97656L8.5459 7.01758H4.68359C4.37598 7.01758 4.1709 6.81592 4.1709 6.52197C4.1709 6.22461 4.37598 6.02637 4.68359 6.02637H8.5459L9.29102 6.06738L8.53564 5.37012L7.77002 4.60107C7.67773 4.51221 7.61279 4.396 7.61279 4.24561C7.61279 3.979 7.81104 3.77734 8.10156 3.77734C8.22119 3.77734 8.34424 3.82861 8.4502 3.93457L10.6753 6.15625C10.7676 6.24854 10.8257 6.38867 10.8257 6.52197Z"
                      fill="white"
                    />
                  </svg>
                  <span> keys to cycle</span>
                </div>
                <span>between different autofill options.</span>
              </div>
            </div>
          </div>
        </div>
        <div className="break-word mt-3 flex w-full items-center">
          Just start typing if you don't want to use Uno's suggestion.
        </div>
      </div>
    </Hotkey>
  );
}
