export interface GuardrailStatus {
  withinWindow: boolean;
  targetTime: string;
  windowStart: string;
  windowEnd: string;
  currentTime: string;
  windowMinutes: number;
}

const TIME_REGEX = /^(\d{1,2}):(\d{2})$/;

function formatTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function evaluateGuardrail(): GuardrailStatus {
  const target = process.env.GUARDRAIL_TARGET_TIME || "23:00";
  const windowMinutes = Number.parseInt(
    process.env.GUARDRAIL_TARGET_WINDOW_IN_MINS || "5",
    10,
  );

  const match = target.match(TIME_REGEX);
  if (!match) {
    throw new Error(
      `Invalid GUARDRAIL_TARGET_TIME format: ${target}. Expected HH:MM (24-hour).`,
    );
  }

  const targetHour = Number.parseInt(match[1], 10);
  const targetMinute = Number.parseInt(match[2], 10);

  if (
    Number.isNaN(targetHour) ||
    Number.isNaN(targetMinute) ||
    targetHour < 0 ||
    targetHour > 23 ||
    targetMinute < 0 ||
    targetMinute > 59
  ) {
    throw new Error(
      `Invalid GUARDRAIL_TARGET_TIME value: ${target}. Hour 0-23, minute 0-59.`,
    );
  }

  const targetMinutes = targetHour * 60 + targetMinute;
  const startMinutes = targetMinutes - windowMinutes;
  const endMinutes = targetMinutes + windowMinutes;

  const now = new Date();
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  const startNormalized = ((startMinutes % 1440) + 1440) % 1440;
  const endNormalized = ((endMinutes % 1440) + 1440) % 1440;

  let withinWindow = false;
  if (startMinutes <= endMinutes && startMinutes >= 0 && endMinutes < 1440) {
    withinWindow = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    withinWindow =
      currentMinutes >= startNormalized || currentMinutes <= endNormalized;
  }

  return {
    withinWindow,
    targetTime: formatTime(targetMinutes),
    windowStart: formatTime(startMinutes),
    windowEnd: formatTime(endMinutes),
    currentTime: formatTime(currentMinutes),
    windowMinutes,
  };
}
