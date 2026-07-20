import { z } from "zod";

// The section library: standard registration building blocks that admins
// toggle and configure per event, instead of a free-form form builder.

export const SECTION_KINDS = [
  "personal",
  "address",
  "medical",
  "emergency",
  "consent",
  "dietary",
  "choice",
  "media_consent",
  "text_block",
  "custom_question",
] as const;

export type SectionKind = (typeof SECTION_KINDS)[number];

export type ChoiceOption = { id: string; label: string; capacity?: number | null };

export type SectionConfigMap = {
  personal: { church?: boolean };
  address: Record<string, never>;
  medical: { medicare?: boolean };
  emergency: Record<string, never>;
  consent: { title?: string; body: string };
  dietary: { options: string[]; detailsPrompt?: string };
  choice: { label: string; options: ChoiceOption[]; multiple?: boolean };
  media_consent: { options: string[] };
  text_block: { title?: string; body: string };
  custom_question: {
    label: string;
    type: "text" | "textarea" | "checkbox" | "select";
    options?: string[];
    placeholder?: string;
  };
};

export type EventSectionDTO = {
  id: number;
  kind: SectionKind;
  position: number;
  required: boolean;
  config: SectionConfigMap[SectionKind];
};

// Default config template shown in the admin editor when adding a section.
export const SECTION_TEMPLATES: { [K in SectionKind]: SectionConfigMap[K] } = {
  personal: { church: true },
  address: {},
  medical: { medicare: true },
  emergency: {},
  consent: { title: "Consent", body: "I agree to the terms of this event." },
  dietary: {
    options: ["Anaphylactic (please provide details below)", "Gluten free", "Vegan", "Other"],
    detailsPrompt: "Please provide details of any allergies or other dietary requirements",
  },
  choice: {
    label: "Please select one option",
    options: [
      { id: "option-1", label: "Option 1", capacity: null },
      { id: "option-2", label: "Option 2", capacity: null },
    ],
    multiple: false,
  },
  media_consent: { options: ["Photo", "Video", "Livestreaming", "I would rather not"] },
  text_block: { title: "Information", body: "Details for attendees." },
  custom_question: { label: "Your question", type: "text" },
};

export const SECTION_LABELS: Record<SectionKind, string> = {
  personal: "Personal details",
  address: "Address",
  medical: "Medical details",
  emergency: "Emergency contact",
  consent: "Consent / agreement",
  dietary: "Dietary requirements",
  choice: "Choice (workshops etc.)",
  media_consent: "Media consent",
  text_block: "Information block",
  custom_question: "Custom question",
};

// Zod config validators, used when the admin saves a section.
const configSchemas: Record<SectionKind, z.ZodTypeAny> = {
  personal: z.object({ church: z.boolean().optional() }),
  address: z.object({}),
  medical: z.object({ medicare: z.boolean().optional() }),
  emergency: z.object({}),
  consent: z.object({ title: z.string().optional(), body: z.string().min(1) }),
  dietary: z.object({
    options: z.array(z.string().min(1)).min(1),
    detailsPrompt: z.string().optional(),
  }),
  choice: z.object({
    label: z.string().min(1),
    options: z
      .array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1),
          capacity: z.number().int().positive().nullable().optional(),
        })
      )
      .min(1),
    multiple: z.boolean().optional(),
  }),
  media_consent: z.object({ options: z.array(z.string().min(1)).min(1) }),
  text_block: z.object({ title: z.string().optional(), body: z.string().min(1) }),
  custom_question: z.object({
    label: z.string().min(1),
    type: z.enum(["text", "textarea", "checkbox", "select"]),
    options: z.array(z.string().min(1)).optional(),
    placeholder: z.string().optional(),
  }),
};

export function parseSectionConfig(kind: SectionKind, raw: unknown) {
  return configSchemas[kind].parse(raw);
}

// Build the zod schema that validates a registrant's answers for one section.
function answerSchema(section: EventSectionDTO): z.ZodTypeAny | null {
  const required = section.required;
  const str = (min = 1) => (required ? z.string().trim().min(min) : z.string().trim().optional().or(z.literal("")));
  switch (section.kind) {
    case "personal": {
      const cfg = section.config as SectionConfigMap["personal"];
      return z.object({
        firstName: z.string().trim().min(1),
        lastName: z.string().trim().min(1),
        email: z.string().trim().email(),
        phone: str(),
        ...(cfg.church ? { church: str() } : {}),
      });
    }
    case "address":
      return z.object({
        street: str(),
        city: str(),
        state: str(),
        postcode: str(),
        country: str(),
      });
    case "medical": {
      const cfg = section.config as SectionConfigMap["medical"];
      return z.object({
        doctorName: str(),
        doctorPhone: str(),
        ...(cfg.medicare ? { medicare: str() } : {}),
      });
    }
    case "emergency":
      return z.object({ name: str(), relationship: str(), mobile: str() });
    case "consent":
      // Unticked checkboxes send nothing, so an optional consent must tolerate
      // a missing value rather than demanding the key be present.
      return z.object({
        agreed: required ? z.literal(true) : z.boolean().optional().default(false),
      });
    case "dietary": {
      const cfg = section.config as SectionConfigMap["dietary"];
      return z.object({
        selected: z.array(z.enum(cfg.options as [string, ...string[]])).default([]),
        details: z.string().trim().optional().or(z.literal("")),
      });
    }
    case "choice": {
      const cfg = section.config as SectionConfigMap["choice"];
      const ids = cfg.options.map((o) => o.id) as [string, ...string[]];
      if (cfg.multiple) {
        const arr = z.array(z.enum(ids));
        return z.object({ selected: required ? arr.min(1) : arr.default([]) });
      }
      return z.object({
        selected: required ? z.enum(ids) : z.enum(ids).optional().or(z.literal("")),
      });
    }
    case "media_consent": {
      const cfg = section.config as SectionConfigMap["media_consent"];
      const arr = z.array(z.enum(cfg.options as [string, ...string[]]));
      return z.object({ selected: required ? arr.min(1) : arr.default([]) });
    }
    case "text_block":
      return null; // informational only
    case "custom_question": {
      const cfg = section.config as SectionConfigMap["custom_question"];
      if (cfg.type === "checkbox") {
        return z.object({
          value: required ? z.literal(true) : z.boolean().optional().default(false),
        });
      }
      if (cfg.type === "select") {
        const opts = (cfg.options ?? []) as [string, ...string[]];
        return z.object({
          value: required ? z.enum(opts) : z.enum(opts).optional().or(z.literal("")),
        });
      }
      return z.object({ value: str() });
    }
  }
}

// answers is keyed by String(section.id).
export function buildAnswersSchema(sections: EventSectionDTO[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const section of sections) {
    const schema = answerSchema(section);
    // A section the registrant never touched sends nothing at all; treat that as
    // an empty answer so optional sections pass and required ones still fail on
    // their own fields rather than on a missing key.
    if (schema) {
      shape[String(section.id)] = z.preprocess((v) => v ?? {}, schema);
    }
  }
  return z.object(shape);
}

export function extractContact(sections: EventSectionDTO[], answers: Record<string, unknown>) {
  const personal = sections.find((s) => s.kind === "personal");
  if (!personal) return null;
  const a = answers[String(personal.id)] as
    | { firstName?: string; lastName?: string; email?: string }
    | undefined;
  if (!a?.firstName || !a?.email) return null;
  return { name: [a.firstName, a.lastName].filter(Boolean).join(" "), email: a.email };
}
