Copyright 2026 Tether Inc

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

This package includes source derived from js-yaml 5.5.0
(https://github.com/nodeca/js-yaml), copyright (C) 2011-2015 by Vitaly Puzrin,
licensed under the MIT License reproduced in LICENSE. Upstream Git history and
source attribution are retained.

Tether additions include the compact Core schema, data writer, public API, build
configuration, tests, and repository tooling. The parser additionally avoids an
unnecessary rollback snapshot for nodes without tag/anchor prefixes. These
changes do not remove or replace the upstream MIT attribution or license.
