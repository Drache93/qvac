#include <string>
#include <unordered_map>

#include <gtest/gtest.h>

#include "model-interface/LlamaModel.hpp"
#include "utils/LoggingMacros.hpp"

using namespace qvac_lib_inference_addon_llama::logging;
using namespace qvac_lib_inference_addon_cpp::logger;

class LoggingMacrosTest : public ::testing::Test {
protected:
  void SetUp() override { g_verbosityLevel = Priority::ERROR; }

  void TearDown() override { g_verbosityLevel = Priority::ERROR; }
};

TEST_F(LoggingMacrosTest, SetVerbosityLevel0) {
  std::unordered_map<std::string, std::string> config;
  config["verbosity"] = "0";

  setVerbosityLevel(config);

  EXPECT_EQ(g_verbosityLevel, Priority::ERROR);
  EXPECT_EQ(config.find("verbosity"), config.end());
}

TEST_F(LoggingMacrosTest, SetVerbosityLevel1) {
  std::unordered_map<std::string, std::string> config;
  config["verbosity"] = "1";

  setVerbosityLevel(config);

  EXPECT_EQ(g_verbosityLevel, Priority::WARNING);
  EXPECT_EQ(config.find("verbosity"), config.end());
}

TEST_F(LoggingMacrosTest, SetVerbosityLevel2) {
  std::unordered_map<std::string, std::string> config;
  config["verbosity"] = "2";

  setVerbosityLevel(config);

  EXPECT_EQ(g_verbosityLevel, Priority::INFO);
  EXPECT_EQ(config.find("verbosity"), config.end());
}

TEST_F(LoggingMacrosTest, SetVerbosityLevel3) {
  std::unordered_map<std::string, std::string> config;
  config["verbosity"] = "3";

  setVerbosityLevel(config);

  EXPECT_EQ(g_verbosityLevel, Priority::DEBUG);
  EXPECT_EQ(config.find("verbosity"), config.end());
}

TEST_F(LoggingMacrosTest, SetVerbosityLevelMissingKey) {
  std::unordered_map<std::string, std::string> config;
  config["other_key"] = "value";

  Priority originalLevel = g_verbosityLevel;
  setVerbosityLevel(config);

  EXPECT_EQ(g_verbosityLevel, originalLevel);
  EXPECT_NE(config.find("other_key"), config.end());
}

TEST_F(LoggingMacrosTest, SetVerbosityLevelEmptyMap) {
  std::unordered_map<std::string, std::string> config;

  Priority originalLevel = g_verbosityLevel;
  setVerbosityLevel(config);

  EXPECT_EQ(g_verbosityLevel, originalLevel);
  EXPECT_TRUE(config.empty());
}

TEST_F(LoggingMacrosTest, SetVerbosityLevelInvalidNegative) {
  std::unordered_map<std::string, std::string> config;
  config["verbosity"] = "-1";

  setVerbosityLevel(config);

  EXPECT_EQ(g_verbosityLevel, Priority::ERROR);
  EXPECT_NE(config.find("verbosity"), config.end());
}

TEST_F(LoggingMacrosTest, SetVerbosityLevelInvalidTooHigh) {
  std::unordered_map<std::string, std::string> config;
  config["verbosity"] = "4";

  setVerbosityLevel(config);

  EXPECT_EQ(g_verbosityLevel, Priority::ERROR);
  EXPECT_NE(config.find("verbosity"), config.end());
}

TEST_F(LoggingMacrosTest, SetVerbosityLevelNonNumeric) {
  std::unordered_map<std::string, std::string> config;
  config["verbosity"] = "invalid";

  setVerbosityLevel(config);

  EXPECT_EQ(g_verbosityLevel, Priority::ERROR);
  EXPECT_EQ(config.find("verbosity"), config.end());
}

TEST_F(LoggingMacrosTest, SetVerbosityLevelEmptyString) {
  std::unordered_map<std::string, std::string> config;
  config["verbosity"] = "";

  setVerbosityLevel(config);

  EXPECT_EQ(g_verbosityLevel, Priority::ERROR);
  EXPECT_EQ(config.find("verbosity"), config.end());
}

TEST_F(LoggingMacrosTest, VerbosityLevelPersistence) {
  std::unordered_map<std::string, std::string> config1;
  config1["verbosity"] = "2";
  setVerbosityLevel(config1);
  EXPECT_EQ(g_verbosityLevel, Priority::INFO);

  std::unordered_map<std::string, std::string> config2;
  config2["verbosity"] = "3";
  setVerbosityLevel(config2);
  EXPECT_EQ(g_verbosityLevel, Priority::DEBUG);
}

TEST_F(LoggingMacrosTest, DefaultVerbosityLevel) {
  EXPECT_EQ(g_verbosityLevel, Priority::ERROR);
}

// The JS logger prints asynchronously, so an error logged just before
// GGML_ABORT (e.g. a CUDA error's details) must also reach stderr directly.
TEST_F(LoggingMacrosTest, LlamaLogCallbackWritesErrorToStderr) {
  testing::internal::CaptureStderr();
  LlamaModel::llamaLogCallback(
      GGML_LOG_LEVEL_ERROR, "CUDA error: out of memory\n", nullptr);
  EXPECT_EQ(
      testing::internal::GetCapturedStderr(), "CUDA error: out of memory\n");
}

TEST_F(LoggingMacrosTest, LlamaLogCallbackKeepsOtherLevelsOffStderr) {
  g_verbosityLevel = Priority::DEBUG;
  testing::internal::CaptureStderr();
  LlamaModel::llamaLogCallback(GGML_LOG_LEVEL_WARN, "warn\n", nullptr);
  LlamaModel::llamaLogCallback(GGML_LOG_LEVEL_INFO, "info\n", nullptr);
  LlamaModel::llamaLogCallback(
      GGML_LOG_LEVEL_DEBUG, "CUDA Graph id 45 reused\n", nullptr);
  EXPECT_EQ(testing::internal::GetCapturedStderr(), "");
}
