type TimeInput = Date | number

export interface TimeParts {
  days: string
  hours: string
  minutes: string
  seconds: string
}

interface CountdownOptions {
  onTick?: (time: TimeParts) => void
  onComplete?: () => void
  endTime?: TimeInput
}

const MS_IN_SECOND = 1000
const MS_IN_MINUTE = MS_IN_SECOND * 60
const MS_IN_HOUR = MS_IN_MINUTE * 60
const MS_IN_DAY = MS_IN_HOUR * 24

const formatToTwoDigits = (value: number): string => {
  const truncated = Math.max(0, Math.trunc(value))
  return String(truncated).padStart(2, '0')
}

const toMilliseconds = (time: TimeInput): number => {
  if (time instanceof Date) return time.getTime()
  if (typeof time === 'number') return time

  throw new TypeError(
    'El valor proporcionado para la cuenta atrás no es una fecha ni un timestamp válido.',
  )
}

export default function createTimer(initialTime: TimeInput, options?: CountdownOptions) {
  const targetTimeMs = options?.endTime
    ? toMilliseconds(options.endTime)
    : toMilliseconds(initialTime)

  let timerInterval: ReturnType<typeof setInterval> | undefined

  const stopTimer = () => {
    if (timerInterval !== undefined) {
      clearInterval(timerInterval)
      timerInterval = undefined
    }
  }

  const executeTick = () => {
    const timeRemaining = targetTimeMs - Date.now()

    if (timeRemaining <= 0) {
      stopTimer()
      options?.onComplete?.()
      return
    }

    if (options?.onTick) {
      options.onTick({
        days: formatToTwoDigits(timeRemaining / MS_IN_DAY),
        hours: formatToTwoDigits((timeRemaining % MS_IN_DAY) / MS_IN_HOUR),
        minutes: formatToTwoDigits((timeRemaining % MS_IN_HOUR) / MS_IN_MINUTE),
        seconds: formatToTwoDigits((timeRemaining % MS_IN_MINUTE) / MS_IN_SECOND),
      })
    }
  }

  const startTimer = () => {
    executeTick()

    if (targetTimeMs > Date.now()) {
      timerInterval = setInterval(executeTick, MS_IN_SECOND)
    }
  }

  return {
    start: startTimer,
    stop: stopTimer,
  }
}
