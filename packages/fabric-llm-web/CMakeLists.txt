cmake_minimum_required(VERSION 3.24)
project(fabric-llm-web LANGUAGES C CXX)

if(NOT EMSCRIPTEN)
  message(FATAL_ERROR "Configure with the pinned Emscripten toolchain")
endif()
if(NOT EXISTS "${FABRIC_SOURCE_DIR}/include/llama.h")
  message(FATAL_ERROR "FABRIC_SOURCE_DIR must point to the locked fabric source")
endif()
if(NOT EXISTS "${EMDAWNWEBGPU_DIR}/emdawnwebgpu.port.py")
  message(FATAL_ERROR "EMDAWNWEBGPU_DIR must point to the locked Dawn package")
endif()

set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(GGML_BACKEND_DL OFF CACHE BOOL "" FORCE)
set(GGML_WEBGPU ON CACHE BOOL "" FORCE)
set(GGML_WEBGPU_JSPI OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(GGML_METAL OFF CACHE BOOL "" FORCE)
set(GGML_VULKAN OFF CACHE BOOL "" FORCE)
set(GGML_CUDA OFF CACHE BOOL "" FORCE)
set(GGML_HIP OFF CACHE BOOL "" FORCE)
set(GGML_OPENCL OFF CACHE BOOL "" FORCE)
set(GGML_BLAS OFF CACHE BOOL "" FORCE)
set(GGML_RPC OFF CACHE BOOL "" FORCE)
set(GGML_LLAMAFILE OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_COMMON ON CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_APP OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_HTML OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_MTMD OFF CACHE BOOL "" FORCE)
set(LLAMA_MTMD OFF CACHE BOOL "" FORCE)
set(LLAMA_OPENSSL OFF CACHE BOOL "" FORCE)
set(LLAMA_SUBPROCESS OFF CACHE BOOL "" FORCE)
set(LLAMA_WASM_MEM64 OFF CACHE BOOL "" FORCE)
add_compile_options(-sMEMORY64=0 "$<$<COMPILE_LANGUAGE:CXX>:-fexceptions>")
add_link_options(-sMEMORY64=0 -fexceptions)
add_subdirectory("${FABRIC_SOURCE_DIR}" fabric EXCLUDE_FROM_ALL)

add_executable(fabric-llm native/bridge.cpp)
target_link_libraries(fabric-llm PRIVATE llama-common llama)
target_compile_features(fabric-llm PRIVATE cxx_std_17)
set_target_properties(fabric-llm PROPERTIES
  SUFFIX ".mjs"
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/dist/wasm-compat")
target_link_options(fabric-llm PRIVATE
  --no-entry
  -sMODULARIZE=1
  -sEXPORT_ES6=1
  -sEXPORT_NAME=createFabricModule
  -sENVIRONMENT=worker
  -sEXIT_RUNTIME=0
  -sALLOW_MEMORY_GROWTH=1
  -sSTACK_SIZE=8388608
  -sMAXIMUM_MEMORY=4294967296
  -lworkerfs.js
  "-sEXPORTED_FUNCTIONS=_web_init,_web_load,_web_begin,_web_step,_web_unload,_web_result,_malloc,_free"
  "-sEXPORTED_RUNTIME_METHODS=ccall,UTF8ToString,FS,HEAPU8"
  -sASSERTIONS=1
  -sASYNCIFY=1
  -sASYNCIFY_STACK_SIZE=1048576)
