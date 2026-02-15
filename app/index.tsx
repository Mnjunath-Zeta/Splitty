import { View, ActivityIndicator } from 'react-native';

export default function Index() {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e1b4b' }}>
            <ActivityIndicator size="large" color="#ffffff" />
        </View>
    );
}
