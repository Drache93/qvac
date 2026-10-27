import { decode } from 'z32';
export const BLIND_PEERING_OFF_KEY = 'debug.blindPeeringOff';
export const BLIND_RELAY_KEYS = [
    'tgbo7m8fh3hwqqxj95zrezorjgodtjr19b9dqruyauwnbafsmx8y',
    'tfo1aqsc4hc4ok6a4akpxifkp65efoo9n13g1386zoa7umjipqpo',
    'cobue4jgch38xkwoua9mohjkomua8bcek1okuq8rkd3gatj5hqfy',
    'wjouex6jjz3zor3t7ww8p59t9r4kx6gw4sar89sjkq7azjcay1ao'
].map((key) => decode(key));
export const BLIND_PEER_KEYS = [
    '5tskygqds4scoymmoc9bmns3qu6rnnfw5knuk8y4nrdydy47bawo',
    'te8q3phdyntxjqyrrn7qtw8mnko3htsgcn8kg8pgymqf9uisiemo',
    'iakqkthgz6fb9awt8og3ftj9ru87pp11ab7zdy135miwnpzjc9ty',
    'm5oqrn5ngpheegoj4jc5yyk4uxo5kfa81t7tpemnjcyzgghc85ko'
].map((key) => decode(key));
