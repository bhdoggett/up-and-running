import type { AppState } from "./types";
import { newId } from "./types";

// A friendly example so a first-time volunteer sees how the app works.
// Fully editable/deletable from the UI.
export function seedState(): AppState {
  const checklistId = newId();
  return {
    active: { kind: "checklist", id: checklistId },
    files: [],
    docs: [
      {
        id: newId(),
        name: "How the sound system is wired",
        resources: [],
        body: `The booth feeds two zones. Nothing here needs checking off — it's
just here so you know what you're looking at.

## Signal path

- **Stage boxes** run to the snake under the platform
- The snake terminates at the **booth patch panel**
- From there into the **board**, then out to:
  - Main speakers (left / right)
  - Monitor sends
  - The lobby feed

## Common gotchas

- Channel 7 is the wireless handheld — it lives on a **different battery** than
  the lapel packs.
- If the lobby goes quiet but the room is fine, check the **zone 2 knob** on the
  amp rack before assuming a dead speaker.
`,
      },
    ],
    checklists: [
      {
        id: checklistId,
        name: "Sunday Service Setup",
        description:
          "Everything that needs doing **before 9:00am**. Work top to bottom — the sound board needs a few minutes to boot, so start that early.",
        resources: [
          {
            id: newId(),
            label: "Full setup walkthrough (video)",
            kind: "web",
            target: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
        ],
        sections: [
          {
            id: newId(),
            name: "Before doors open",
            collapsed: false,
            tasks: [
          {
            id: newId(),
            title: "Unlock the building & turn on lights",
            details:
              "Main door key is on the blue lanyard in the lockbox (code 1-2-3-4). Light switches are in the panel just inside the foyer — flip all of them up.",
            done: false,
            resources: [],
          },
          {
            id: newId(),
            title: "Power on the sound board",
            details:
              "Turn on the wall power first, then the board, then the speakers — in that order to avoid a loud pop. Wait for the board to finish booting before touching faders.",
            done: false,
            resources: [
              {
                id: newId(),
                label: "Sound board walkthrough (video)",
                kind: "web",
                target: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
              },
            ],
          },
            ],
          },
          {
            id: newId(),
            name: "Hospitality",
            collapsed: false,
            tasks: [
              {
                id: newId(),
                title: "Set up the coffee station",
                details:
                  "Two urns: one regular, one decaf. Fill to the line, one scoop of grounds per marked level. Start them by 8:15 so they're ready before people arrive.",
                done: false,
                resources: [],
              },
              {
                id: newId(),
                title: "Put out welcome signage",
                details:
                  "Sandwich board by the main entrance, plus the directional sign at the parking lot corner.",
                done: false,
                resources: [],
              },
            ],
          },
        ],
      },
    ],
  };
}
