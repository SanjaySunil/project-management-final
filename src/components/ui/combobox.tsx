"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

const Combobox = ComboboxPrimitive.Root

const ComboboxValue = React.forwardRef<
  HTMLSpanElement,
  ComboboxPrimitive.Value.Props
>((props, ref) => {
  return <ComboboxPrimitive.Value ref={ref} data-slot="combobox-value" {...props} />
})
ComboboxValue.displayName = "ComboboxValue"

const ComboboxTrigger = React.forwardRef<
  HTMLButtonElement,
  ComboboxPrimitive.Trigger.Props
>(({ className, children, ...props }, ref) => {
  return (
    <ComboboxPrimitive.Trigger
      ref={ref}
      data-slot="combobox-trigger"
      className={cn("[&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    >
      {children}
      <ChevronDownIcon
        data-slot="combobox-trigger-icon"
        className="text-muted-foreground pointer-events-none size-4"
      />
    </ComboboxPrimitive.Trigger>
  )
})
ComboboxTrigger.displayName = "ComboboxTrigger"

const ComboboxClear = React.forwardRef<
  HTMLButtonElement,
  ComboboxPrimitive.Clear.Props
>(({ className, ...props }, ref) => {
  return (
    <ComboboxPrimitive.Clear
      ref={ref}
      data-slot="combobox-clear"
      render={<InputGroupButton variant="ghost" size="icon-xs" />}
      className={cn(className)}
      {...props}
    >
      <XIcon className="pointer-events-none" />
    </ComboboxPrimitive.Clear>
  )
})
ComboboxClear.displayName = "ComboboxClear"

const ComboboxInput = React.forwardRef<
  HTMLInputElement,
  ComboboxPrimitive.Input.Props & {
    showTrigger?: boolean
    showClear?: boolean
  }
>(
  (
    {
      className,
      children,
      disabled = false,
      showTrigger = true,
      showClear = false,
      ...props
    },
    ref
  ) => {
    return (
      <InputGroup className={cn("w-auto", className)}>
        <ComboboxPrimitive.Input
          ref={ref}
          render={<InputGroupInput disabled={disabled} />}
          {...props}
        />
        <InputGroupAddon align="inline-end">
          {showTrigger && (
            <InputGroupButton
              size="icon-xs"
              variant="ghost"
              asChild
              data-slot="input-group-button"
              className="group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent"
              disabled={disabled}
            >
              <ComboboxTrigger />
            </InputGroupButton>
          )}
          {showClear && <ComboboxClear disabled={disabled} />}
        </InputGroupAddon>
        {children}
      </InputGroup>
    )
  }
)
ComboboxInput.displayName = "ComboboxInput"

const ComboboxContent = React.forwardRef<
  HTMLDivElement,
  ComboboxPrimitive.Popup.Props &
    Pick<
      ComboboxPrimitive.Positioner.Props,
      "side" | "align" | "sideOffset" | "alignOffset" | "anchor"
    >
>(
  (
    {
      className,
      side = "bottom",
      sideOffset = 6,
      align = "start",
      alignOffset = 0,
      anchor,
      ...props
    },
    ref
  ) => {
    return (
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          side={side}
          sideOffset={sideOffset}
          align={align}
          alignOffset={alignOffset}
          anchor={anchor}
          className="isolate z-100"
        >
          <ComboboxPrimitive.Popup
            ref={ref}
            data-slot="combobox-content"
            data-chips={!!anchor}
            className={cn(
              "bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:border-input/30 group/combobox-content relative max-h-96 w-(--anchor-width) max-w-(--available-width) min-w-[200px] origin-(--transform-origin) overflow-hidden rounded-md shadow-md ring-1 duration-100 data-[chips=true]:min-w-(--anchor-width) *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:shadow-none",
              className
            )}
            {...props}
          />
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    )
  }
)
ComboboxContent.displayName = "ComboboxContent"

const ComboboxList = React.forwardRef<
  HTMLDivElement,
  ComboboxPrimitive.List.Props
>(({ className, ...props }, ref) => {
  return (
    <ComboboxPrimitive.List
      ref={ref}
      data-slot="combobox-list"
      className={cn(
        "max-h-72 scroll-py-1 overflow-y-auto p-1 data-empty:p-0",
        className
      )}
      {...props}
    />
  )
})
ComboboxList.displayName = "ComboboxList"

const ComboboxItem = React.forwardRef<
  HTMLDivElement,
  ComboboxPrimitive.Item.Props
>(({ className, children, textValue, ...props }, ref) => {
  return (
    <ComboboxPrimitive.Item
      ref={ref}
      data-slot="combobox-item"
      textValue={textValue}
      className={cn(
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator
        data-slot="combobox-item-indicator"
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none size-4 pointer-coarse:size-5" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
})
ComboboxItem.displayName = "ComboboxItem"

const ComboboxGroup = React.forwardRef<
  HTMLDivElement,
  ComboboxPrimitive.Group.Props
>(({ className, ...props }, ref) => {
  return (
    <ComboboxPrimitive.Group
      ref={ref}
      data-slot="combobox-group"
      className={cn(className)}
      {...props}
    />
  )
})
ComboboxGroup.displayName = "ComboboxGroup"

const ComboboxLabel = React.forwardRef<
  HTMLDivElement,
  ComboboxPrimitive.GroupLabel.Props
>(({ className, ...props }, ref) => {
  return (
    <ComboboxPrimitive.GroupLabel
      ref={ref}
      data-slot="combobox-label"
      className={cn(
        "text-muted-foreground px-2 py-1.5 text-xs pointer-coarse:px-3 pointer-coarse:py-2 pointer-coarse:text-sm",
        className
      )}
      {...props}
    />
  )
})
ComboboxLabel.displayName = "ComboboxLabel"

const ComboboxCollection = ComboboxPrimitive.Collection

const ComboboxEmpty = React.forwardRef<
  HTMLDivElement,
  ComboboxPrimitive.Empty.Props
>(({ className, ...props }, ref) => {
  return (
    <ComboboxPrimitive.Empty
      ref={ref}
      data-slot="combobox-empty"
      className={cn(
        "text-muted-foreground flex w-full justify-center py-2 text-center text-sm",
        className
      )}
      {...props}
    />
  )
})
ComboboxEmpty.displayName = "ComboboxEmpty"

const ComboboxSeparator = React.forwardRef<
  HTMLDivElement,
  ComboboxPrimitive.Separator.Props
>(({ className, ...props }, ref) => {
  return (
    <ComboboxPrimitive.Separator
      ref={ref}
      data-slot="combobox-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
})
ComboboxSeparator.displayName = "ComboboxSeparator"

const ComboboxChips = React.forwardRef<
  HTMLDivElement,
  ComboboxPrimitive.Chips.Props
>(({ className, ...props }, ref) => {
  return (
    <ComboboxPrimitive.Chips
      ref={ref}
      data-slot="combobox-chips"
      className={cn(
        "dark:bg-input/30 border-input focus-within:border-ring focus-within:ring-ring/50 has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40 has-aria-invalid:border-destructive dark:has-aria-invalid:border-destructive/50 flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-transparent bg-clip-padding px-2.5 py-1.5 text-sm shadow-xs transition-[color,box-shadow] focus-within:ring-[3px] has-aria-invalid:ring-[3px] has-data-[slot=combobox-chip]:px-1.5",
        className
      )}
      {...props}
    />
  )
})
ComboboxChips.displayName = "ComboboxChips"

const ComboboxChip = React.forwardRef<
  HTMLDivElement,
  ComboboxPrimitive.Chip.Props & {
    showRemove?: boolean
  }
>(({ className, children, showRemove = true, ...props }, ref) => {
  return (
    <ComboboxPrimitive.Chip
      ref={ref}
      data-slot="combobox-chip"
      className={cn(
        "bg-muted text-foreground flex h-[calc(--spacing(5.5))] w-fit items-center justify-center gap-1 rounded-sm px-1.5 text-xs font-medium whitespace-nowrap has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[slot=combobox-chip-remove]:pr-0",
        className
      )}
      {...props}
    >
      {children}
      {showRemove && (
        <ComboboxPrimitive.ChipRemove
          render={<Button variant="ghost" size="icon-xs" />}
          className="-ml-1 opacity-50 hover:opacity-100"
          data-slot="combobox-chip-remove"
        >
          <XIcon className="pointer-events-none" />
        </ComboboxPrimitive.ChipRemove>
      )}
    </ComboboxPrimitive.Chip>
  )
})
ComboboxChip.displayName = "ComboboxChip"

const ComboboxChipsInput = React.forwardRef<
  HTMLInputElement,
  ComboboxPrimitive.Input.Props
>(({ className, children, ...props }, ref) => {
  return (
    <ComboboxPrimitive.Input
      ref={ref}
      data-slot="combobox-chip-input"
      className={cn("min-w-16 flex-1 outline-none", className)}
      {...props}
    />
  )
})
ComboboxChipsInput.displayName = "ComboboxChipsInput"

function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null)
}

export {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
}
