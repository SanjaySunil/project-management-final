import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  GetCountries,
  GetState,
  GetCity,
} from "react-country-state-city"
import { getTimezonesForCountry } from "countries-and-timezones"
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandDialog,
} from "@/components/ui/command"

interface ClientFormProps {
  initialValues?: Partial<{
    first_name: string
    last_name: string | null
    email: string | null
    phone: string | null
    address: string | null
    country: string | null
    state: string | null
    city: string | null
    timezone: string | null
    notes: string | null
    user_id: string | null
  }>
  onSubmit: (values: any) => void
  onCancel: () => void
  isLoading?: boolean
}

const STATE_TIMEZONES: Record<string, string> = {
  // US States
  "alabama": "America/Chicago",
  "alaska": "America/Anchorage",
  "arizona": "America/Phoenix",
  "arkansas": "America/Chicago",
  "california": "America/Los_Angeles",
  "colorado": "America/Denver",
  "connecticut": "America/New_York",
  "delaware": "America/New_York",
  "dc": "America/New_York",
  "district of columbia": "America/New_York",
  "florida": "America/New_York",
  "georgia": "America/New_York",
  "hawaii": "Pacific/Honolulu",
  "idaho": "America/Boise",
  "illinois": "America/Chicago",
  "indiana": "America/Indiana/Indianapolis",
  "iowa": "America/Chicago",
  "kansas": "America/Chicago",
  "kentucky": "America/New_York",
  "louisiana": "America/Chicago",
  "maine": "America/New_York",
  "maryland": "America/New_York",
  "massachusetts": "America/New_York",
  "michigan": "America/Detroit",
  "minnesota": "America/Chicago",
  "mississippi": "America/Chicago",
  "missouri": "America/Chicago",
  "montana": "America/Denver",
  "nebraska": "America/Chicago",
  "nevada": "America/Los_Angeles",
  "new hampshire": "America/New_York",
  "new jersey": "America/New_York",
  "new mexico": "America/Denver",
  "new york": "America/New_York",
  "north carolina": "America/New_York",
  "north dakota": "America/Chicago",
  "ohio": "America/New_York",
  "oklahoma": "America/Chicago",
  "oregon": "America/Los_Angeles",
  "pennsylvania": "America/New_York",
  "rhode island": "America/New_York",
  "south carolina": "America/New_York",
  "south dakota": "America/Chicago",
  "tennessee": "America/Chicago",
  "texas": "America/Chicago",
  "utah": "America/Denver",
  "vermont": "America/New_York",
  "virginia": "America/New_York",
  "washington": "America/Los_Angeles",
  "west virginia": "America/New_York",
  "wisconsin": "America/Chicago",
  "wyoming": "America/Denver",
}

import { Switch } from "@/components/ui/switch"

const clientSchema = z.object({
  first_name: z.string().min(2, "First name must be at least 2 characters"),
  last_name: z.string().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().optional(),
  notes: z.string().optional(),
  enable_login: z.boolean(),
})

type ClientFormValues = z.infer<typeof clientSchema>

export function ClientForm({ initialValues, onSubmit, onCancel, isLoading }: ClientFormProps) {
  const [countriesList, setCountriesList] = React.useState<any[]>([])
  const [statesList, setStatesList] = React.useState<any[]>([])
  const [citiesList, setCitiesList] = React.useState<any[]>([])
  const [selectedCountry, setSelectedCountry] = React.useState<any>(null)
  const [selectedState, setSelectedState] = React.useState<any>(null)
  const [isCountryPickerOpen, setIsCountryPickerOpen] = React.useState(false)
  const [isStatePickerOpen, setIsStatePickerOpen] = React.useState(false)
  const [isCityPickerOpen, setIsCityPickerOpen] = React.useState(false)

  const schema = React.useMemo(() => clientSchema, [])

  React.useEffect(() => {
    GetCountries().then((result) => {
      setCountriesList(result)
      if (initialValues?.country) {
        const country = result.find((c: any) => c.name === initialValues.country)
        if (country) {
          setSelectedCountry(country)
          GetState(country.id).then((states) => {
            setStatesList(states)
            if (initialValues.state) {
              const state = states.find((s: any) => s.name === initialValues.state)
              if (state) {
                setSelectedState(state)
                GetCity(country.id, state.id).then((cities) => {
                  setCitiesList(cities)
                })
              }
            }
          })
        }
      }
    })
  }, [initialValues?.country, initialValues?.state])

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: initialValues?.first_name || "",
      last_name: initialValues?.last_name || "",
      phone: initialValues?.phone || "",
      address: initialValues?.address || "",
      country: initialValues?.country || "",
      state: initialValues?.state || "",
      city: initialValues?.city || "",
      timezone: initialValues?.timezone || "",
      notes: initialValues?.notes || "",
      enable_login: !!initialValues?.user_id,
    },
  })

  const watchEnableLogin = form.watch("enable_login")

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input placeholder="John" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="+1 234 567 890" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <FormField
            control={form.control}
            name="enable_login"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <FormLabel>Enable Login Access</FormLabel>
                  <div className="text-xs text-muted-foreground">
                    Allow the client to log in and view their projects.
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {watchEnableLogin && initialValues?.user_id ? (
            <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
              Login access is enabled for this client.
            </div>
          ) : !watchEnableLogin && initialValues?.user_id ? (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded font-medium">
              Warning: Disabling this will revoke the client's access to all their projects.
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Country (Optional)</FormLabel>
                <FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start font-normal"
                    onClick={() => setIsCountryPickerOpen(true)}
                  >
                    {field.value ? (
                      <span className="flex items-center gap-2 text-left">
                        <span>{countriesList.find(c => c.name === field.value)?.emoji}</span>
                        <span className="truncate">{field.value}</span>
                      </span>
                    ) : (
                      "Select country..."
                    )}
                  </Button>
                </FormControl>
                <CommandDialog 
                  open={isCountryPickerOpen} 
                  onOpenChange={setIsCountryPickerOpen}
                  title="Select Country"
                >
                  <CommandInput placeholder="Search country..." />
                  <CommandList className="max-h-[400px] overflow-y-auto">
                    <CommandEmpty>No country found.</CommandEmpty>
                    <CommandGroup>
                      {countriesList.map((country) => (
                        <CommandItem
                          key={country.id}
                          value={country.name}
                          onSelect={() => {
                            field.onChange(country.name)
                            setSelectedCountry(country)
                            setSelectedState(null)
                            form.setValue("state", "")
                            form.setValue("city", "")
                            setCitiesList([])
                            GetState(country.id).then((result) => {
                              setStatesList(result)
                            })
                            // Auto-set timezone if country has only one
                            const tzs = getTimezonesForCountry(country.iso2)
                            if (tzs && tzs.length === 1) {
                              form.setValue("timezone", tzs[0].name)
                            }
                            setIsCountryPickerOpen(false)
                          }}
                        >
                          <span className="mr-2">{country.emoji}</span>
                          {country.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </CommandDialog>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>State (Optional)</FormLabel>
                <FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start font-normal"
                    onClick={() => setIsStatePickerOpen(true)}
                    disabled={!selectedCountry}
                  >
                    <span className="truncate">
                      {field.value || "Select state..."}
                    </span>
                  </Button>
                </FormControl>
                <CommandDialog 
                  open={isStatePickerOpen} 
                  onOpenChange={setIsStatePickerOpen}
                  title="Select State"
                >
                  <CommandInput placeholder="Search state..." />
                  <CommandList className="max-h-[300px] overflow-y-auto">
                    <CommandEmpty>No state found.</CommandEmpty>
                    <CommandGroup>
                      {statesList.map((state) => (
                        <CommandItem
                          key={state.id}
                          value={state.name}
                          onSelect={() => {
                            field.onChange(state.name)
                            setSelectedState(state)
                            form.setValue("city", "")
                            if (selectedCountry) {
                              GetCity(selectedCountry.id, state.id).then((result) => {
                                setCitiesList(result)
                              })

                              // Auto-set timezone based on state if country is USA
                              if (selectedCountry.iso2 === 'US' || selectedCountry.name?.toLowerCase() === 'united states') {
                                const stateTz = STATE_TIMEZONES[state.name.toLowerCase()]
                                if (stateTz) {
                                  form.setValue("timezone", stateTz)
                                }
                              }
                            }
                            setIsStatePickerOpen(false)
                          }}
                        >
                          {state.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </CommandDialog>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>City (Optional)</FormLabel>
                <FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start font-normal"
                    onClick={() => setIsCityPickerOpen(true)}
                    disabled={!selectedState}
                  >
                    <span className="truncate">
                      {field.value || "Select city..."}
                    </span>
                  </Button>
                </FormControl>
                <CommandDialog 
                  open={isCityPickerOpen} 
                  onOpenChange={setIsCityPickerOpen}
                  title="Select City"
                >
                  <CommandInput placeholder="Search city..." />
                  <CommandList className="max-h-[300px] overflow-y-auto">
                    <CommandEmpty>No city found.</CommandEmpty>
                    <CommandGroup>
                      {citiesList.map((city) => (
                        <CommandItem
                          key={city.id}
                          value={city.name}
                          onSelect={() => {
                            field.onChange(city.name)
                            if (selectedCountry) {
                              const tzs = getTimezonesForCountry(selectedCountry.iso2)
                              if (tzs && tzs.length > 0) {
                                const cityNormalized = city.name.toLowerCase().replace(/\s+/g, '_')
                                const matchedTz = tzs.find(tz => 
                                  tz.name.toLowerCase().endsWith(`/${cityNormalized}`)
                                )
                                if (matchedTz) {
                                  form.setValue("timezone", matchedTz.name)
                                } else if (tzs.length === 1) {
                                  form.setValue("timezone", tzs[0].name)
                                }
                              }
                            }
                            setIsCityPickerOpen(false)
                          }}
                        >
                          {city.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </CommandDialog>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem className="hidden">
              <FormControl>
                <input type="hidden" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="123 Main St, City, Country" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Additional information..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : (initialValues?.first_name ? "Save Changes" : "Save Client")}
          </Button>
        </div>
      </form>
    </Form>
  )
}
