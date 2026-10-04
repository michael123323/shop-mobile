import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  FlatList,
  SafeAreaView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('Connecting...');

  // ---------- LOGIN STATE ----------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // ---------- LOAD CART ----------
  const loadCart = useCallback(async () => {
    const { data, error } = await supabase
      .from('cart_items')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.log(error);
      setStatus('Could not load cart: ' + error.message);
      return;
    }
    setItems(data || []);
  }, []);

  // ---------- LIVE SYNC ----------
  useEffect(() => {
    if (!session) {
      setItems([]);
      return;
    }

    loadCart();

    const channel = supabase
      .channel('cart-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cart_items',
          filter: `user_id=eq.${session.user.id}`,
        },
        () => loadCart()
      )
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') setStatus('Live');
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setStatus('Live updates off (checking every 4s)');
      });

    // Backup: refresh every 4 seconds in case Realtime is slow
    const timer = setInterval(loadCart, 4000);

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [session, loadCart]);

  // ---------- GOOGLE LOGIN ----------
  async function signInWithGoogle() {
    try {
      const redirectTo = Linking.createURL('auth');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success') {
        const code = new URL(result.url).searchParams.get('code');
        if (!code) throw new Error('No login code came back from Google.');
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      }
    } catch (e) {
      Alert.alert('Login failed', e.message);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  // ---------- SCREENS ----------
  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>HNG Shop</Text>
        <Text style={styles.text}>Please sign in to see your cart.</Text>
        <Button title="Sign in with Google" onPress={signInWithGoogle} />
      </View>
    );
  }

  const total = items.reduce(
    (sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0),
    0
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>My Cart</Text>
        <Text style={styles.small}>{session.user.email}</Text>
        <Text style={styles.small}>Sync: {status}</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Your cart is empty. Add an item on the website and it will appear here.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.product_name}</Text>
              <Text style={styles.small}>Quantity: {item.quantity}</Text>
            </View>
            <Text style={styles.price}>
              ₦{(Number(item.price || 0) * Number(item.quantity || 0)).toLocaleString()}
            </Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Text style={styles.total}>Total: ₦{total.toLocaleString()}</Text>
        <Button title="Refresh" onPress={loadCart} />
        <View style={{ height: 8 }} />
        <Button title="Sign out" color="#c0392b" onPress={signOut} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', paddingTop: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 28, fontWeight: 'bold' },
  text: { fontSize: 16, marginBottom: 12 },
  small: { fontSize: 13, color: '#666' },
  empty: { padding: 24, textAlign: 'center', color: '#666' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemName: { fontSize: 17, fontWeight: '600' },
  price: { fontSize: 16, fontWeight: '600' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  total: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
});