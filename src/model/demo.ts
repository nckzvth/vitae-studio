import type { Project, ThemeId, ThemeSettings } from "./types";

export const themePresets: Record<ThemeId, ThemeSettings> = {
  academic: {
    preset: "academic",
    accent: "#183a34",
    text: "#18201e",
    muted: "#65706d",
    paper: "#fffefb",
    headingFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "Georgia, 'Times New Roman', serif",
    bodySize: 10.5,
    headingSize: 12,
    lineHeight: 1.45,
    sectionGap: 18,
    ruleWidth: 1,
  },
  modern: {
    preset: "modern",
    accent: "#1c5d99",
    text: "#17202a",
    muted: "#5d6872",
    paper: "#ffffff",
    headingFont: "Arial, Helvetica, sans-serif",
    bodyFont: "Arial, Helvetica, sans-serif",
    bodySize: 10,
    headingSize: 11.5,
    lineHeight: 1.4,
    sectionGap: 16,
    ruleWidth: 2,
  },
  editorial: {
    preset: "editorial",
    accent: "#a13d2d",
    text: "#241d1b",
    muted: "#756762",
    paper: "#fffdf8",
    headingFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "Arial, Helvetica, sans-serif",
    bodySize: 10.5,
    headingSize: 13,
    lineHeight: 1.5,
    sectionGap: 22,
    ruleWidth: 0,
  },
  technical: {
    preset: "technical",
    accent: "#5c4d91",
    text: "#1f2130",
    muted: "#696b79",
    paper: "#ffffff",
    headingFont: "Arial, Helvetica, sans-serif",
    bodyFont: "Arial, Helvetica, sans-serif",
    bodySize: 9.5,
    headingSize: 11,
    lineHeight: 1.35,
    sectionGap: 13,
    ruleWidth: 1,
  },
};

const now = new Date().toISOString();

export function createDemoProject(): Project {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: "Maya Chen — Academic CV",
    profile: {
      fullName: "Dr. Maya Chen",
      professionalTitle: "Environmental Data Scientist",
      summary:
        "Researcher translating complex climate and public-health data into practical policy tools.",
      contacts: [
        {
          id: crypto.randomUUID(),
          label: "Email",
          value: "maya.chen@example.com",
          href: "mailto:maya.chen@example.com",
        },
        { id: crypto.randomUUID(), label: "Location", value: "Boston, MA" },
        {
          id: crypto.randomUUID(),
          label: "Web",
          value: "mayachen.example",
          href: "https://example.com",
        },
      ],
    },
    sections: [
      {
        id: crypto.randomUUID(),
        title: "Research Experience",
        kind: "research",
        entries: [
          {
            id: crypto.randomUUID(),
            title: "Research Fellow, Climate & Health Lab",
            organization: "Northbridge Institute of Technology",
            location: "Cambridge, MA",
            date: "2023 — Present",
            summary:
              "Lead an interdisciplinary program studying neighborhood heat exposure and respiratory outcomes.",
            bullets: [
              "Designed a reproducible geospatial pipeline joining satellite, sensor, and longitudinal health data.",
              "Mentor four graduate researchers and coordinate partnerships with three city agencies.",
            ],
          },
          {
            id: crypto.randomUUID(),
            title: "Doctoral Researcher",
            organization: "Redwood University",
            location: "Portland, OR",
            date: "2018 — 2023",
            summary:
              "Developed interpretable models for estimating climate-related health risks under sparse observations.",
            bullets: [
              "Published open methods and teaching datasets used in two graduate seminars.",
            ],
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        title: "Education",
        kind: "education",
        entries: [
          {
            id: crypto.randomUUID(),
            title: "Ph.D., Environmental Engineering",
            organization: "Redwood University",
            location: "Portland, OR",
            date: "2023",
            summary:
              "Dissertation: Equitable inference for urban climate adaptation.",
            bullets: [],
          },
          {
            id: crypto.randomUUID(),
            title: "B.S., Applied Mathematics, summa cum laude",
            organization: "Lakeview College",
            location: "Chicago, IL",
            date: "2017",
            bullets: [],
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        title: "Selected Presentations",
        kind: "presentations",
        entries: [
          {
            id: crypto.randomUUID(),
            title: "Heat inequity at the block scale",
            organization: "International Symposium on Urban Climate",
            location: "Rotterdam, Netherlands",
            date: "2025",
            summary: "Invited oral presentation.",
            bullets: [],
          },
          {
            id: crypto.randomUUID(),
            title: "Auditable models for sparse public-health data",
            organization: "Open Science Methods Conference",
            location: "Montreal, Canada",
            date: "2024",
            summary: "Peer-reviewed poster presentation.",
            bullets: [],
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        title: "Honors & Service",
        kind: "honors",
        entries: [
          {
            id: crypto.randomUUID(),
            title: "Early Career Research Fellowship",
            organization: "Society for Environmental Data",
            date: "2024",
            bullets: [],
          },
          {
            id: crypto.randomUUID(),
            title: "Co-chair, Reproducible Research Working Group",
            organization: "Northbridge Institute of Technology",
            date: "2023 — Present",
            bullets: [
              "Organize monthly clinics on documentation, review, and responsible data sharing.",
            ],
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        title: "Methods & Tools",
        kind: "skills",
        entries: [
          {
            id: crypto.randomUUID(),
            title: "Research methods",
            summary:
              "Causal inference, spatial statistics, survey design, mixed methods",
            bullets: [],
          },
          {
            id: crypto.randomUUID(),
            title: "Software",
            summary:
              "Python, R, SQL, QGIS, Git, reproducible research workflows",
            bullets: [],
          },
        ],
      },
    ],
    theme: { ...themePresets.academic },
    layout: {
      paper: "letter",
      mode: "date-rail",
      margin: 44,
      showGuides: false,
      showPageNumbers: true,
    },
    imports: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankProject(): Project {
  const project = createDemoProject();
  return {
    ...project,
    name: "Untitled CV",
    profile: {
      fullName: "Your name",
      professionalTitle: "Professional title",
      contacts: [],
    },
    sections: [
      {
        id: crypto.randomUUID(),
        title: "Experience",
        kind: "experience",
        entries: [],
      },
      {
        id: crypto.randomUUID(),
        title: "Education",
        kind: "education",
        entries: [],
      },
    ],
  };
}
