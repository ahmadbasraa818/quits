import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

require('react-native-reanimated').setUpTests();

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
