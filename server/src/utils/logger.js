import pino from 'pino'

const level = process.env.LOG_LEVEL || 'info'
const isProd = process.env.NODE_ENV === 'production'

let logger
if (!isProd) {
	logger = pino(
		pino.transport({
			target: 'pino-pretty',
			options: { colorize: true, translateTime: 'yyyy-mm-dd HH:MM:ss.l', ignore: 'pid,hostname' },
		}),
	)
} else {
	logger = pino({ level })
}

export default logger
