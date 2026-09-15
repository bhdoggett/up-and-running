import type { AppState } from "./types";
import { newId } from "./types";

// A friendly example so a first-time volunteer sees how the app works.
// Fully editable/deletable from the UI.
export function seedState(): AppState {
  const checklistId = newId();
  return {
    activeChecklistId: checklistId,
    checklists: [
      {
        id: checklistId,
        name: "Sunday Service Setup",
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
          {
            id: newId(),
            title: "Set up the coffee station",
            details:
              "Two urns: one regular, one decaf. Fill to the line, one scoop of grounds per marked level. Start them by 8:15 so they're ready before people arrive.",
            done: false,
            resources: [],
          },
        ],
      },
    ],
  };
}
