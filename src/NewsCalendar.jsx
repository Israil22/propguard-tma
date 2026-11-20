import { useEffect, useRef } from 'react'

export default function NewsCalendar() {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.innerHTML = ''

    const widgetDiv = document.createElement('div')
    widgetDiv.id = 'economicCalendarWidget'
    container.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.async = true
    script.type = 'text/javascript'
    script.src = 'https://www.tradays.com/c/js/widgets/calendar/widget.js?v=13'
    script.setAttribute('data-type', 'calendar-widget')
    script.text = JSON.stringify({
      width: '100%',
      height: '650',
      mode: '2',
      lang: 'ru',
      theme: 1
    })

    container.appendChild(script)

    return () => {
      container.innerHTML = ''
    }
  }, [])

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden p-2">
      <div ref={containerRef} className="w-full min-h-[650px]" />
    </div>
  )
}