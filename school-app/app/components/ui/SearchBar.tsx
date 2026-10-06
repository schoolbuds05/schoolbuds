import type { ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, TextInput, View } from 'react-native';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onSubmitEditing?: () => void;
  icon?: ComponentProps<typeof Feather>['name'];
};

export default function SearchBar({
  value,
  onChangeText,
  placeholder,
  onSubmitEditing,
  icon = 'search',
}: Props) {
  return (
    <View style={styles.container}>
      <Feather name={icon} size={15} color="#FFFFFF" />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.92)"
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 12,
  },
});
