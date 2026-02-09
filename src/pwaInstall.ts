type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: BeforeInstallPromptEvent | null = null;

export function initPwaInstallCapture(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Prevent Chrome from showing the mini-infobar
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
  });
}

export function canInstallPwa(): boolean {
  return deferred !== null;
}

export async function promptInstallPwa(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  await deferred.prompt();
  const choice = await deferred.userChoice;
  deferred = null;
  return choice.outcome;
}
