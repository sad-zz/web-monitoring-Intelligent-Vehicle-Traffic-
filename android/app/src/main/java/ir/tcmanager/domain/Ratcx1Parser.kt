package ir.tcmanager.domain

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Parser for the RATCX1 TCP protocol as documented in CLAUDE.md.
 *
 * Message codes:
 *  8000  Device→Server  Handshake
 *  0012  Server→Device  Time sync command
 *  8012  Device→Server  Time sync ACK
 *  0197  Server→Device  Request interval data
 *  8821  Device→Server  Interval data response (262+ chars)
 */
object Ratcx1Parser {

    // ── Outbound Commands ────────────────────────────────────────

    /** Build a 0012 TIME_SYNC command with current server time. */
    fun buildTimeSync(): String {
        val now = Calendar.getInstance()
        val fmt = SimpleDateFormat("yyMMddHHmmss", Locale.US)
        return "0012${fmt.format(now.time)}"
    }

    /**
     * Build a 0197 POLL command for the last completed 5-minute interval.
     * Format: 0197 + YYMMDDHHmm
     */
    fun buildPoll(offsetMinutes: Int = 0): String {
        val cal = Calendar.getInstance()
        // Round down to last completed 5-min block, then subtract offset
        val min = cal.get(Calendar.MINUTE)
        cal.set(Calendar.MINUTE, (min / 5) * 5)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        if (offsetMinutes > 0) {
            cal.add(Calendar.MINUTE, -offsetMinutes)
        }
        val fmt = SimpleDateFormat("yyMMddHHmm", Locale.US)
        return "0197${fmt.format(cal.time)}"
    }

    // ── Inbound Parsers ──────────────────────────────────────────

    fun identifyMessage(raw: String): MessageType {
        return when {
            raw.startsWith("8000") -> MessageType.HANDSHAKE
            raw.startsWith("8012") -> MessageType.TIME_SYNC_ACK
            raw.startsWith("8821") -> MessageType.INTERVAL_DATA
            raw.startsWith("0012") -> MessageType.TIME_SYNC_CMD
            raw.startsWith("0197") -> MessageType.POLL_CMD
            else -> MessageType.UNKNOWN
        }
    }

    /**
     * Parse a Handshake message (8000).
     * Format: 8000 + datetime(21) + sysId(8) + model + READY
     */
    fun parseHandshake(raw: String): HandshakeMessage? {
        if (!raw.startsWith("8000") || raw.length < 33) return null
        return try {
            val datetime = raw.substring(4, 25)
            val sysId = raw.substring(25, 33)
            val rest = raw.substring(33)
            val modelEnd = rest.indexOf("READY").let { if (it < 0) rest.length else it }
            val model = rest.substring(0, modelEnd).trim()
            HandshakeMessage(datetime = datetime, sysId = sysId, model = model)
        } catch (_: Exception) { null }
    }

    /**
     * Parse a Time Sync ACK (8012).
     * Format: 8012 + datetime(21) + sysId(8)
     */
    fun parseTimeSyncAck(raw: String): TimeSyncAck? {
        if (!raw.startsWith("8012") || raw.length < 33) return null
        return try {
            val datetime = raw.substring(4, 25)
            val sysId = raw.substring(25, 33)
            TimeSyncAck(datetime = datetime, sysId = sysId)
        } catch (_: Exception) { null }
    }

    /**
     * Parse an Interval Data message (8821).
     * Format: 8821 + datetime(21) + intervalData(262+ chars)
     *
     * Interval data structure (0-indexed after the 21-char datetime):
     *  [0-7]     sysId (8 digits)
     *  [8-17]    interval datetime YYMMDDHHmm
     *  [18-131]  Lane1: 6 classes × 19 chars
     *             each class: count(4) + avgSpeed(3) + violation(4) + grab(4) + headway(4)
     *  [132-134] Lane1 occupancy
     *  [135-248] Lane2: same
     *  [249-251] Lane2 occupancy
     *  [252-254] Battery voltage (e.g. "123" = 12.3V)
     *  [255-257] Solar voltage
     *  [258-261] Error byte (4 chars hex)
     */
    fun parseIntervalData(raw: String): IntervalData? {
        if (!raw.startsWith("8821") || raw.length < 4 + 21 + 262) return null
        return try {
            val deviceDatetime = raw.substring(4, 25)
            val d = raw.substring(25) // interval payload

            val sysId = d.substring(0, 8)
            val intervalTime = d.substring(8, 18)

            val lane1 = parseLane(d.substring(18, 132))
            val lane1Occupancy = d.substring(132, 135).trim().toIntOrNull() ?: 0

            val lane2 = parseLane(d.substring(135, 249))
            val lane2Occupancy = d.substring(249, 252).trim().toIntOrNull() ?: 0

            val batteryRaw = d.substring(252, 255).trim().toIntOrNull() ?: 0
            val solarRaw = d.substring(255, 258).trim().toIntOrNull() ?: 0
            val errorByte = d.substring(258, 262).trim()

            IntervalData(
                deviceDatetime = deviceDatetime,
                sysId = sysId,
                intervalTime = intervalTime,
                lane1 = lane1,
                lane1Occupancy = lane1Occupancy,
                lane2 = lane2,
                lane2Occupancy = lane2Occupancy,
                batteryVoltage = batteryRaw / 10.0,
                solarVoltage = solarRaw / 10.0,
                errorByte = errorByte
            )
        } catch (_: Exception) { null }
    }

    /** Parse 6 vehicle classes from a 114-char lane block (6 × 19 chars). */
    private fun parseLane(block: String): LaneData {
        val classes = (0 until 6).map { i ->
            val offset = i * 19
            VehicleClass(
                count = block.substring(offset, offset + 4).trim().toIntOrNull() ?: 0,
                avgSpeed = block.substring(offset + 4, offset + 7).trim().toIntOrNull() ?: 0,
                violations = block.substring(offset + 7, offset + 11).trim().toIntOrNull() ?: 0,
                grabs = block.substring(offset + 11, offset + 15).trim().toIntOrNull() ?: 0,
                headway = block.substring(offset + 15, offset + 19).trim().toIntOrNull() ?: 0
            )
        }
        return LaneData(
            motorcycle = classes[0],
            car = classes[1],
            van = classes[2],
            bus = classes[3],
            truck = classes[4],
            other = classes[5]
        )
    }

    // ── Data Classes ────────────────────────────────────────────

    enum class MessageType { HANDSHAKE, TIME_SYNC_CMD, TIME_SYNC_ACK, POLL_CMD, INTERVAL_DATA, UNKNOWN }

    data class HandshakeMessage(
        val datetime: String,
        val sysId: String,
        val model: String
    )

    data class TimeSyncAck(
        val datetime: String,
        val sysId: String
    )

    data class VehicleClass(
        val count: Int,
        val avgSpeed: Int,
        val violations: Int,
        val grabs: Int,
        val headway: Int
    ) {
        val label: String get() = when {
            count == 0 && avgSpeed == 0 -> "—"
            else -> "تعداد: $count | سرعت: ${avgSpeed}km/h | تخلف: $violations"
        }
    }

    data class LaneData(
        val motorcycle: VehicleClass,
        val car: VehicleClass,
        val van: VehicleClass,
        val bus: VehicleClass,
        val truck: VehicleClass,
        val other: VehicleClass
    ) {
        val totalVehicles: Int get() = motorcycle.count + car.count + van.count + bus.count + truck.count + other.count
        val totalViolations: Int get() = motorcycle.violations + car.violations + van.violations + bus.violations + truck.violations + other.violations
        val averageSpeed: Int get() {
            val classes = listOf(motorcycle, car, van, bus, truck, other).filter { it.count > 0 }
            val totalVehiclesInLane = classes.sumOf { it.count }
            return if (totalVehiclesInLane == 0) 0
            else classes.sumOf { it.avgSpeed * it.count } / totalVehiclesInLane
        }
    }

    data class IntervalData(
        val deviceDatetime: String,
        val sysId: String,
        val intervalTime: String,
        val lane1: LaneData,
        val lane1Occupancy: Int,
        val lane2: LaneData,
        val lane2Occupancy: Int,
        val batteryVoltage: Double,
        val solarVoltage: Double,
        val errorByte: String
    ) {
        val totalVehicles: Int get() = lane1.totalVehicles + lane2.totalVehicles
        val hasError: Boolean get() = errorByte.trim() != "0000" && errorByte.trim() != "0"
    }
}
