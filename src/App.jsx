// 以下为更新后的完整 MealPlanner 组件，加入弹出整行编辑对话框功能
import React, { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, isBefore, setHours, setMinutes } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { supabase } from './supabaseClient';

const meals = ['早', '中', '晚'];
const mealDeadlines = [6, 9, 14];

const MealPlanner = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [data, setData] = useState([]);
  const [names, setNames] = useState([]);
  const [globalUserMap, setGlobalUserMap] = useState({});
  const [editingUser, setEditingUser] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);

  const startDay = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const currentStart = format(startDay, 'yyyy-MM-dd');
  const currentEnd = format(addDays(startDay, 6), 'yyyy-MM-dd');

  useEffect(() => {
    fetchData();
  }, [currentWeek]);

  const fetchData = async () => {
    const { data: rows } = await supabase
      .from('meal_plan')
      .select('*')
      .gte('meal_date', currentStart)
      .lte('meal_date', currentEnd);

    const grouped = {};
    rows.forEach(row => {
      const key = row.user_name;
      if (!grouped[key]) grouped[key] = { name: row.user_name, count: 1, plans: {} };
      grouped[key].plans[`${row.meal_date}-${row.meal_type}`] = row.meal_count;
    });

    const inferred = Object.values(grouped).map(u => {
      const mealCounts = Object.values(u.plans);
      const avgCount = mealCounts.length ? Math.round(mealCounts.reduce((a, b) => a + b, 0) / mealCounts.length) : 1;
      return { ...u, count: avgCount };
    });

    if (inferred.length > 0) {
      setNames(inferred);
      setGlobalUserMap(prev => {
        const updated = { ...prev };
        inferred.forEach(u => {
          updated[u.name] = u.count;
        });
        return updated;
      });
    } else {
      const inherited = Object.entries(globalUserMap).map(([name, count]) => ({ name, count, plans: {} }));
      setNames(inherited);
    }

    setData(rows);
  };

  const persistUserPlans = async (user) => {
    const records = Object.entries(user.plans).map(([key, count]) => {
      const [meal_date, meal_type] = key.split('-');
      return {
        user_name: user.name,
        meal_date,
        meal_type,
        meal_count: user.count || count || 1,
      };
    });
    if (records.length > 0) {
      await Promise.all(records.map(r => supabase.from('meal_plan').upsert(r)));
    }
  };

  const changeWeek = async (direction) => {
    for (const user of names) {
      if (user.name && Object.keys(user.plans).length > 0) {
        await persistUserPlans(user);
      }
    }
    setCurrentWeek(addDays(currentWeek, direction * 7));
  };

  const handleCheck = (user, day, meal) => {
    const index = names.findIndex(u => u.name === user.name);
    if (index === -1) return;
    const confirmEdit = window.confirm('你确定要修改他人的用餐计划吗？');
    if (!confirmEdit) return;
    setEditingUser({ ...names[index] });
    setEditingIndex(index);
  };

  const updateUserPlans = async () => {
    const updatedNames = [...names];
    updatedNames[editingIndex] = editingUser;
    setNames(updatedNames);
    setEditingUser(null);
    setEditingIndex(null);
    await persistUserPlans(editingUser);
  };

  const getMealCount = (day, meal) => {
    return names.reduce((sum, user) => {
      const key = `${format(day, 'yyyy-MM-dd')}-${meal}`;
      return sum + (user.plans?.[key] ? user.count : 0);
    }, 0);
  };

  const canCheck = (day, mealIdx) => {
    const deadline = setMinutes(setHours(day, mealDeadlines[mealIdx]), 0);
    return isBefore(new Date(), deadline);
  };

  const toggleEditCheckbox = (day, meal) => {
    const key = `${day}-${meal}`;
    const plans = { ...editingUser.plans };
    if (plans[key]) {
      delete plans[key];
    } else {
      plans[key] = editingUser.count;
    }
    setEditingUser({ ...editingUser, plans });
  };

  // updateCount, updateName, deleteUser, addUser 保持原样（略）...

  return (
    <div className="p-6 font-sans max-w-full overflow-x-auto">
      <h2 className="text-3xl font-bold mb-6 text-center">升龙公司德合厂用餐计划表</h2>

      {/* 原表格渲染保持不变 */}

      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-xl w-full max-w-3xl">
            <h3 className="text-xl font-bold mb-4">编辑 {editingUser.name} 的用餐计划</h3>
            <div className="grid grid-cols-7 gap-2">
              {[...Array(7)].map((_, dayIdx) => {
                const day = addDays(startDay, dayIdx);
                const dateStr = format(day, 'yyyy-MM-dd');
                return (
                  <div key={dayIdx}>
                    <div className="text-center font-semibold mb-2">
                      {format(day, 'MM/dd EEE', { locale: zhCN })}
                    </div>
                    {meals.map(meal => {
                      const key = `${dateStr}-${meal}`;
                      return (
                        <div key={meal} className="text-center">
                          <label>
                            <input
                              type="checkbox"
                              checked={!!editingUser.plans[key]}
                              onChange={() => toggleEditCheckbox(dateStr, meal)}
                            /> {meal}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-right">
              <button className="bg-gray-400 text-white px-4 py-1 rounded mr-2" onClick={() => setEditingUser(null)}>取消</button>
              <button className="bg-blue-600 text-white px-4 py-1 rounded" onClick={updateUserPlans}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MealPlanner;
