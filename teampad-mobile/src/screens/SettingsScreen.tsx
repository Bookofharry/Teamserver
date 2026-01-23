import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Switch,
    Alert,
    Modal,
    Linking,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { haptics } from '../utils/haptics';
import { BackgroundGlow } from '../components/BackgroundGlow';
import { createSlideUp, getAnimatedStyle } from '../utils/animations';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation';

type Props = NativeStackScreenProps<AppStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
    const introAnim = useRef(createSlideUp(260, 12)).current;
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [vibrationEnabled, setVibrationEnabled] = useState(true);
    const [showAboutModal, setShowAboutModal] = useState(false);

    const handleToggleNotifications = (value: boolean) => {
        haptics.selection();
        setNotificationsEnabled(value);
    };

    const handleToggleSound = (value: boolean) => {
        haptics.selection();
        setSoundEnabled(value);
    };

    const handleToggleVibration = (value: boolean) => {
        haptics.selection();
        setVibrationEnabled(value);
    };

    const handleOpenLink = async (url: string) => {
        haptics.light();
        try {
            await Linking.openURL(url);
        } catch {
            Alert.alert('Error', 'Could not open link');
        }
    };

    const handleContactSupport = () => {
        haptics.light();
        handleOpenLink('mailto:support@teampad.app');
    };

    const handleDeleteAccount = () => {
        haptics.heavy();
        Alert.alert(
            'Delete Account',
            'This action is permanent and cannot be undone. All your data will be deleted. Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert('Contact Support', 'Please contact support@teampad.app to delete your account.');
                    },
                },
            ]
        );
    };

    useEffect(() => {
        introAnim.start();
    }, [introAnim]);

    return (
        <View style={styles.container}>
            <BackgroundGlow tint="blue" />
            <Animated.View style={[styles.content, getAnimatedStyle(introAnim.opacity, introAnim.translateY)]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.contentContainer}>
                {/* Notifications Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notifications</Text>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Push Notifications</Text>
                            <Text style={styles.settingDescription}>Receive alerts for new messages</Text>
                        </View>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={handleToggleNotifications}
                            trackColor={{ false: '#333', true: '#3b82f6' }}
                            thumbColor="#fff"
                        />
                    </View>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Sound</Text>
                            <Text style={styles.settingDescription}>Play sounds for notifications</Text>
                        </View>
                        <Switch
                            value={soundEnabled}
                            onValueChange={handleToggleSound}
                            trackColor={{ false: '#333', true: '#3b82f6' }}
                            thumbColor="#fff"
                            disabled={!notificationsEnabled}
                        />
                    </View>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Vibration</Text>
                            <Text style={styles.settingDescription}>Vibrate for notifications</Text>
                        </View>
                        <Switch
                            value={vibrationEnabled}
                            onValueChange={handleToggleVibration}
                            trackColor={{ false: '#333', true: '#3b82f6' }}
                            thumbColor="#fff"
                            disabled={!notificationsEnabled}
                        />
                    </View>
                </View>

                {/* Account Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Two-Factor Authentication</Text>
                            <Text style={styles.settingDescription}>
                                {user?.twoFactorEnabled ? 'Enabled' : 'Not enabled'}
                            </Text>
                        </View>
                        <View style={[styles.statusBadge, user?.twoFactorEnabled && styles.statusBadgeActive]}>
                            <Text style={[styles.statusText, user?.twoFactorEnabled && styles.statusTextActive]}>
                                {user?.twoFactorEnabled ? 'On' : 'Off'}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={() => {
                            haptics.light();
                            Alert.alert('Change Password', 'Password changes are managed through the web app.');
                        }}
                    >
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Change Password</Text>
                            <Text style={styles.settingDescription}>Update your account password</Text>
                        </View>
                        <Text style={styles.settingArrow}>→</Text>
                    </TouchableOpacity>
                </View>

                {/* About Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About</Text>

                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={() => {
                            haptics.light();
                            setShowAboutModal(true);
                        }}
                    >
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>App Version</Text>
                            <Text style={styles.settingDescription}>1.0.0</Text>
                        </View>
                        <Text style={styles.settingArrow}>→</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={() => handleOpenLink('https://teampad.app/terms')}
                    >
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Terms of Service</Text>
                        </View>
                        <Text style={styles.settingArrow}>→</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={() => handleOpenLink('https://teampad.app/privacy')}
                    >
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Privacy Policy</Text>
                        </View>
                        <Text style={styles.settingArrow}>→</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingRow} onPress={handleContactSupport}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Contact Support</Text>
                            <Text style={styles.settingDescription}>support@teampad.app</Text>
                        </View>
                        <Text style={styles.settingArrow}>→</Text>
                    </TouchableOpacity>
                </View>

                {/* Danger Zone */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, styles.dangerTitle]}>Danger Zone</Text>

                    <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAccount}>
                        <Text style={styles.dangerButtonText}>Delete Account</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* About Modal */}
            <Modal
                visible={showAboutModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowAboutModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.aboutIconCircle}>
                            <Text style={styles.aboutIcon}>📱</Text>
                        </View>
                        <Text style={styles.modalTitle}>Teampad</Text>
                        <Text style={styles.modalVersion}>Version 1.0.0</Text>
                        <Text style={styles.modalDescription}>
                            The collaborative workspace for teams. Notes, chat, and more in one place.
                        </Text>
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setShowAboutModal(false)}
                        >
                            <Text style={styles.modalCloseText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    content: {
        flex: 1,
        zIndex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
    },
    backButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#141414',
        borderWidth: 1,
        borderColor: '#262626',
    },
    backText: {
        color: '#dbeafe',
        fontSize: 14,
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    headerRight: {
        width: 60,
    },
    scroll: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        textTransform: 'uppercase',
        marginBottom: 12,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#111',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    settingInfo: {
        flex: 1,
        marginRight: 12,
    },
    settingLabel: {
        fontSize: 16,
        color: '#fff',
        marginBottom: 2,
    },
    settingDescription: {
        fontSize: 12,
        color: '#666',
    },
    settingArrow: {
        fontSize: 18,
        color: '#666',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#333',
    },
    statusBadgeActive: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderColor: '#3b82f6',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
    },
    statusTextActive: {
        color: '#3b82f6',
    },
    dangerTitle: {
        color: '#ef4444',
    },
    dangerButton: {
        backgroundColor: '#111',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ef4444',
    },
    dangerButtonText: {
        color: '#ef4444',
        fontSize: 16,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#222',
        alignItems: 'center',
    },
    aboutIconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    aboutIcon: {
        fontSize: 28,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    modalVersion: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
    },
    modalDescription: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    modalCloseButton: {
        width: '100%',
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#3b82f6',
        alignItems: 'center',
    },
    modalCloseText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});
