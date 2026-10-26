package io.tether.qvac.sdk

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import to.holepunch.barerpc.Message
import to.holepunch.barerpc.Messages
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull

class JvmBareRpcTransportTest {
    @Test
    fun exchangesJsonWithTheWorker() = runBlocking {
        withWorkerSocket { transport, worker ->
            val workerJob = async(Dispatchers.IO) {
                val request = assertIs<Message.Request>(worker.readMessage())
                worker.write(Message.Response(request.id, 0u, "{\"type\":\"heartbeat\",\"number\":7}".encodeToByteArray(), null))
            }

            val response = transport.call(buildJsonObject { put("type", "heartbeat") })

            assertEquals("heartbeat", response["type"]?.jsonPrimitive?.content)
            workerJob.await()
        }
    }

    @Test
    fun duplexSendsThePayloadThenTheInputThenEndsTheRequestStream() = runBlocking {
        withWorkerSocket { transport, worker ->
            val workerJob = async(Dispatchers.IO) {
                val request = assertIs<Message.Request>(worker.readMessage())
                assertEquals(STREAM_OPEN, request.stream)
                assertNull(request.data)
                assertEquals(STREAM_RESPONSE or STREAM_OPEN, assertIs<Message.Stream>(worker.readMessage()).flags)
                worker.write(Message.Stream(request.id, STREAM_REQUEST or STREAM_OPEN, null, null))

                assertContentEquals("{\"type\":\"duplex\"}".encodeToByteArray(), worker.readRequestData())
                assertContentEquals("input".encodeToByteArray(), worker.readRequestData())
                assertEquals(STREAM_REQUEST or STREAM_END, assertIs<Message.Stream>(worker.readMessage()).flags)

                worker.write(Message.Response(request.id, STREAM_OPEN, null, null))
                worker.write(Message.Stream(request.id, STREAM_RESPONSE or STREAM_DATA, "{\"type\":\"output\"}\n".encodeToByteArray(), null))
                worker.write(Message.Stream(request.id, STREAM_RESPONSE or STREAM_END, null, null))
            }

            val output = transport.duplex(
                buildJsonObject { put("type", "duplex") },
                flowOf("input".encodeToByteArray()),
            ).toList()

            assertEquals("output", output.single()["type"]?.jsonPrimitive?.content)
            workerJob.await()
        }
    }

    @Test
    fun cancellingADuplexCollectionEndsTheRequestStream() = runBlocking {
        withWorkerSocket { transport, worker ->
            val workerJob = async(Dispatchers.IO) {
                val request = assertIs<Message.Request>(worker.readMessage())
                worker.readMessage()
                worker.write(Message.Stream(request.id, STREAM_REQUEST or STREAM_OPEN, null, null))
                worker.readRequestData()
                worker.write(Message.Response(request.id, STREAM_OPEN, null, null))
                worker.write(Message.Stream(request.id, STREAM_RESPONSE or STREAM_DATA, "{\"type\":\"partial\"}\n".encodeToByteArray(), null))

                // The input never ends on its own: the client must end it once
                // the collector stops, so the worker's duplex session can finish.
                assertEquals(STREAM_REQUEST or STREAM_END, assertIs<Message.Stream>(worker.readMessage()).flags)
                worker.write(Message.Stream(request.id, STREAM_RESPONSE or STREAM_END, null, null))
            }

            val first = CompletableDeferred<String>()
            val collector = launch {
                transport.duplex(buildJsonObject { put("type", "duplex") }, flow { awaitCancellation() })
                    .collect { first.complete(it["type"]?.jsonPrimitive?.content.orEmpty()) }
            }
            withTimeout(5_000) {
                assertEquals("partial", first.await())
                collector.cancelAndJoin()
                workerJob.await()
            }
        }
    }
}

private const val STREAM_OPEN = 0x1uL
private const val STREAM_DATA = 0x10uL
private const val STREAM_END = 0x20uL
private const val STREAM_REQUEST = 0x100uL
private const val STREAM_RESPONSE = 0x200uL

private suspend fun withWorkerSocket(block: suspend CoroutineScope.(JvmBareRpcTransport, Socket) -> Unit) = coroutineScope {
    val server = ServerSocket(0, 1, InetAddress.getLoopbackAddress())
    val worker = Socket(InetAddress.getLoopbackAddress(), server.localPort)
    val host = withContext(Dispatchers.IO) { server.accept() }
    val transport = JvmBareRpcTransport(host)
    try {
        block(transport, worker)
    } finally {
        transport.close()
        worker.close()
        server.close()
    }
}

private fun Socket.readMessage(): Message {
    val input = getInputStream()
    val prefix = input.readNBytes(4)
    require(prefix.size == 4)
    val length = (prefix[0].toInt() and 0xff) or
        ((prefix[1].toInt() and 0xff) shl 8) or
        ((prefix[2].toInt() and 0xff) shl 16) or
        ((prefix[3].toInt() and 0xff) shl 24)
    return Messages.decode(prefix + input.readNBytes(length)).message
}

private fun Socket.readRequestData(): ByteArray? {
    val chunk = assertIs<Message.Stream>(readMessage())
    assertEquals(STREAM_REQUEST or STREAM_DATA, chunk.flags)
    return chunk.data
}

private fun Socket.write(message: Message) {
    getOutputStream().write(Messages.encode(message))
    getOutputStream().flush()
}
