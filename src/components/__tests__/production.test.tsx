import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import AboutScreen from '@/app/about';
import PrivacyScreen from '@/app/privacy';
import { useRecovery } from '@/store/recovery';

import { saveBackupFile } from '../backup-file';
import { CrashScreen, issueUrl } from '../crash-screen';
import { Notices } from '../notices';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false } }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('../backup-file', () => ({ saveBackupFile: jest.fn(() => Promise.resolve()), pickBackupFile: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  useRecovery.setState({ setAside: [], notSaving: false });
});

describe('when a screen throws', () => {
  it('offers a way out, with the groups untouched', async () => {
    const user = userEvent.setup();
    const retry = jest.fn();
    await render(<CrashScreen error={new Error('Cannot read properties of undefined')} retry={retry} />);
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();

    await user.press(screen.getByText('Try again'));
    expect(retry).toHaveBeenCalledTimes(1);

    await user.press(screen.getByText('Go to your groups'));
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(retry).toHaveBeenCalledTimes(2);

    await user.press(screen.getByText('Save a backup'));
    expect(saveBackupFile).toHaveBeenCalledWith(expect.stringMatching(/^quits-backup-\d{4}-\d{2}-\d{2}\.json$/), expect.stringContaining('"app": "quits"'));
    expect(await screen.findByText('Backup saved')).toBeOnTheScreen();

    await user.press(screen.getByText('Report the problem'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(expect.stringContaining('github.com/ahmadbasraa818/quits/issues/new'));

    await user.press(screen.getByText('Show the details'));
    expect(screen.getByTestId('crash-details')).toHaveTextContent('Cannot read properties of undefined');
  });

  it('fills in a report with the version and the error, and nothing from the groups', () => {
    const report = decodeURIComponent(issueUrl(new Error('Something broke')));
    expect(report).toContain('Quits stopped with an error');
    expect(report).toContain('Something broke');
    expect(report).toMatch(/Quits (\d+\.\d+\.\d+|unknown) on (ios|android|web)/);
    expect(report).not.toContain('Japan trip');
  });
});

describe('notices on the groups screen', () => {
  it('offers to save data that was set aside, then delete it', async () => {
    const user = userEvent.setup();
    useRecovery.setState({ setAside: [{ at: '2026-10-04T08:00:00.000Z', what: 'the group “Broken trip”', data: '{"id":"g_bad"}' }] });
    await render(<Notices />);
    expect(screen.getByText('Some saved data couldn’t be read')).toBeOnTheScreen();
    expect(screen.getByText(/Quits couldn’t read the group “Broken trip”, so it set it aside/)).toBeOnTheScreen();

    await user.press(screen.getByTestId('save-set-aside'));
    expect(saveBackupFile).toHaveBeenCalledWith(expect.stringMatching(/^quits-unreadable-/), expect.stringContaining('g_bad'));

    await user.press(screen.getByTestId('delete-set-aside'));
    await user.press(await screen.findByTestId('confirm'));
    await waitFor(() => expect(screen.queryByText('Some saved data couldn’t be read')).toBeNull());
    expect(useRecovery.getState().setAside).toEqual([]);
  });

  it('says when the device isn’t saving, and offers a backup', async () => {
    const user = userEvent.setup();
    useRecovery.setState({ notSaving: true });
    await render(<Notices />);
    expect(screen.getByText('This browser isn’t saving your changes')).toBeOnTheScreen();
    await user.press(screen.getByTestId('save-not-saving'));
    expect(saveBackupFile).toHaveBeenCalledWith(expect.stringMatching(/^quits-backup-/), expect.stringContaining('"groups"'));
  });

  it('shows nothing when all is well', async () => {
    await render(<Notices />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('privacy and the version', () => {
  it('explains what Quits keeps and what leaves the device', async () => {
    await render(<PrivacyScreen />);
    expect(screen.getByText('Your groups stay yours')).toBeOnTheScreen();
    for (const heading of ['What Quits keeps', 'What leaves your device', 'Where the web version is served from', 'Deleting your data']) {
      expect(screen.getByText(heading)).toBeOnTheScreen();
    }
  });

  it('shows the version in About, with privacy and a way to report a problem', async () => {
    await render(<AboutScreen />);
    expect(screen.getByTestId('app-version')).toHaveTextContent(/^Quits (\d+\.\d+\.\d+|unknown)$/);
    expect(screen.getByTestId('open-privacy')).toBeOnTheScreen();
    expect(screen.getByTestId('report-problem')).toBeOnTheScreen();
  });
});
