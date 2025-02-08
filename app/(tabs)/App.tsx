import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import EmergencyCallScreen from './index'; // Ensure the path is correct

const Stack = createStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="EmergencyCall">
        <Stack.Screen name="EmergencyCall" component={EmergencyCallScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;

